package com.techverse.server.api;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * HTTP adapter cho các UC đang được frontend sử dụng.
 *
 * <p>Controller dùng JdbcTemplate để bám sát schema Flyway hiện có (UUID, snake_case),
 * đồng thời chuyển đổi kết quả sang camelCase đúng với domain types của Next.js.
 * Session token là token ngắn hạn trong memory cho môi trường MVP; production nên thay
 * bằng JWT/Redis và không lưu token thô.</p>
 */
@RestController
@RequestMapping("/api")
public class ApiController {
    private final JdbcTemplate db;
    private final PasswordEncoder passwords;
    private final Map<String, UUID> sessions = new ConcurrentHashMap<>();

    public ApiController(JdbcTemplate db, PasswordEncoder passwords) {
        this.db = db; this.passwords = passwords;
    }

    /** Endpoint health đơn giản để xác nhận backend đã khởi động; giao diện chính chạy ở Next.js :3000. */
    @GetMapping({"", "/"})
    public Map<String, Object> health() {
        return out("name", "TechVerse API", "status", "UP", "api", "/api", "frontend", "http://localhost:3000");
    }

    // ----- Authentication / profile (UC đăng ký, đăng nhập, đăng xuất, xem hồ sơ) -----
    public record RegisterRequest(@NotBlank String fullName, @Email @NotBlank String email, @NotBlank String password) {}
    public record LoginRequest(@Email @NotBlank String email, @NotBlank String password) {}

    @PostMapping("/auth/register")
    public Map<String, Object> register(@Valid @RequestBody RegisterRequest input) {
        if (!db.queryForList("select id from techverse.users where email = ?", input.email()).isEmpty())
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email đã được sử dụng");
        UUID id = UUID.randomUUID();
        db.update("insert into techverse.users(id, full_name, email, password) values (?, ?, ?, ?)", id, input.fullName().trim(), input.email().trim().toLowerCase(), passwords.encode(input.password()));
        return authResponse(id);
    }

    @PostMapping("/auth/login")
    public Map<String, Object> login(@Valid @RequestBody LoginRequest input) {
        var rows = db.queryForList("select id, password, is_active from techverse.users where email = ?", input.email().trim().toLowerCase());
        if (rows.isEmpty() || !Boolean.TRUE.equals(rows.getFirst().get("is_active")) || !passwords.matches(input.password(), String.valueOf(rows.getFirst().get("password"))))
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Email hoặc mật khẩu không đúng");
        return authResponse((UUID) rows.getFirst().get("id"));
    }

    @PostMapping("/auth/logout")
    public Map<String, Object> logout(HttpServletRequest request) { sessions.remove(token(request)); return Map.of("success", true); }

    @GetMapping("/auth/me")
    public Map<String, Object> me(HttpServletRequest request) { return user(requireUser(request)); }

    private Map<String, Object> authResponse(UUID id) {
        String token = UUID.randomUUID().toString(); sessions.put(token, id);
        return Map.of("token", token, "user", user(id));
    }
    private UUID requireUser(HttpServletRequest request) {
        UUID id = sessions.get(token(request));
        if (id == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Yêu cầu đăng nhập");
        return id;
    }
    private String token(HttpServletRequest request) {
        String value = request.getHeader("Authorization");
        return value != null && value.startsWith("Bearer ") ? value.substring(7) : "";
    }
    private Map<String, Object> user(UUID id) {
        // Không dùng Collectors.toMap ở đây vì profile có thể có avatar/email_verified_at = null.
        var row = db.queryForMap("select u.id, u.full_name, u.email, u.avatar_url, u.is_active, u.email_verified_at, coalesce(array_agg(r.name) filter (where r.name is not null), array[]::varchar[]) roles from techverse.users u left join techverse.user_roles ur on ur.user_id=u.id left join techverse.roles r on r.id=ur.role_id where u.id=? group by u.id", id);
        var result = new LinkedHashMap<String, Object>();
        row.forEach((key, value) -> {
            // PostgreSQL trả array_agg dưới dạng java.sql.Array; không trả object JDBC
            // trực tiếp vì Jackson sẽ serialize cả metadata/connection rất lớn.
            if ("roles".equals(key)) value = normaliseRoles(value);
            result.put(camel(key), value);
        });
        return result;
    }

    /** Chuẩn hóa String[], java.sql.Array hoặc PGobject của PostgreSQL thành List<String> cho React. */
    private List<String> normaliseRoles(Object value) {
        if (value == null) return List.of();
        try {
            if (value instanceof java.sql.Array sqlArray) value = sqlArray.getArray();
            if (value instanceof String[] strings) return Arrays.asList(strings);
            if (value instanceof Object[] objects) return Arrays.stream(objects).map(String::valueOf).toList();
            // PGobject nằm trong driver runtime; dùng reflection để không kéo driver vào compile classpath.
            if (value.getClass().getName().equals("org.postgresql.util.PGobject"))
                value = value.getClass().getMethod("getValue").invoke(value);
        } catch (Exception ignored) {
            return List.of();
        }
        String text = String.valueOf(value).trim();
        if (text.startsWith("{") && text.endsWith("}")) text = text.substring(1, text.length() - 1);
        if (text.isBlank()) return List.of();
        return Arrays.stream(text.split(",")).map(item -> item.trim().replace("\"", "")).filter(item -> !item.isBlank()).toList();
    }

    // ----- Taxonomy (UC xem/lọc theo chủ đề) -----
    @GetMapping("/topics")
    public List<Map<String, Object>> topics() { return db.queryForList("select id, name, description, is_active from techverse.topics where is_active order by name").stream().map(this::camelRow).toList(); }

    // ----- Public content (UC xem, tìm kiếm, lọc, xem chi tiết) -----
    @GetMapping("/articles")
    public Map<String, Object> articles(@RequestParam(required=false) String query, @RequestParam(required=false) UUID topicId, @RequestParam(defaultValue="1") int page) {
        String q = "select a.id,a.slug,a.title,a.summary,a.content,a.cover_image_url,a.published_at,u.id author_id,u.full_name author_name,t.id topic_id,t.name topic_name from techverse.articles a join techverse.users u on u.id=a.author_id join techverse.topics t on t.id=a.topic_id where a.status='PUBLISHED' and (cast(? as uuid) is null or a.topic_id=cast(? as uuid)) and (cast(? as text) is null or lower(a.title||' '||a.summary) like lower('%'||cast(? as text)||'%')) order by a.published_at desc limit 50";
        return page(db.queryForList(q, topicId, topicId, blank(query), blank(query)).stream().map(this::article).toList(), page);
    }
    @GetMapping("/articles/{slug}")
    public Map<String,Object> article(@PathVariable String slug) { return article(db.queryForMap("select a.id,a.slug,a.title,a.summary,a.content,a.cover_image_url,a.published_at,u.id author_id,u.full_name author_name,t.id topic_id,t.name topic_name from techverse.articles a join techverse.users u on u.id=a.author_id join techverse.topics t on t.id=a.topic_id where a.slug=? and a.status='PUBLISHED'", slug)); }

    @GetMapping("/documents")
    public Map<String,Object> documents(@RequestParam(required=false) String query, @RequestParam(defaultValue="1") int page) {
        String q="select d.*,u.full_name author_name from techverse.documents d join techverse.users u on u.id=d.author_id where d.status='PUBLISHED' and (cast(? as text) is null or lower(d.title||' '||d.summary) like lower('%'||cast(? as text)||'%')) order by d.published_at desc limit 50";
        return page(db.queryForList(q, blank(query), blank(query)).stream().map(this::document).toList(), page);
    }
    @GetMapping("/documents/{id}")
    public Map<String,Object> document(@PathVariable UUID id) { return document(db.queryForMap("select d.*,u.full_name author_name from techverse.documents d join techverse.users u on u.id=d.author_id where d.id=? and d.status='PUBLISHED'", id)); }

    @GetMapping("/courses")
    public Map<String,Object> courses(@RequestParam(required=false) String query, @RequestParam(defaultValue="1") int page, HttpServletRequest request) {
        UUID user = sessions.get(token(request));
        String q="select c.*,u.full_name author_name,t.name topic_name, exists(select 1 from techverse.course_enrollments ce where ce.course_id=c.id and ce.user_id=cast(? as uuid) and ce.revoked_at is null) enrolled from techverse.courses c join techverse.users u on u.id=c.author_id join techverse.topics t on t.id=c.topic_id where c.status='PUBLISHED' and (cast(? as text) is null or lower(c.title||' '||c.summary) like lower('%'||cast(? as text)||'%')) order by c.published_at desc limit 50";
        return page(db.queryForList(q, user, blank(query), blank(query)).stream().map(this::course).toList(), page);
    }
    @GetMapping("/courses/{id}")
    public Map<String,Object> course(@PathVariable UUID id, HttpServletRequest request) { UUID user=sessions.get(token(request)); var row=db.queryForMap("select c.*,u.full_name author_name,t.name topic_name, exists(select 1 from techverse.course_enrollments ce where ce.course_id=c.id and ce.user_id=? and ce.revoked_at is null) enrolled from techverse.courses c join techverse.users u on u.id=c.author_id join techverse.topics t on t.id=c.topic_id where c.id=? and c.status='PUBLISHED'", user,id); var result=course(row); result.put("lessons", db.queryForList("select l.*, exists(select 1 from techverse.lesson_progress lp where lp.lesson_id=l.id and lp.user_id=?) completed from techverse.lessons l where l.course_id=? order by l.position",user,id).stream().map(this::lesson).toList()); return result; }

    // ----- Practice and community (UC luyện tập, đăng câu hỏi) -----
    @GetMapping("/exercises") public List<Map<String,Object>> exercises() { return db.queryForList("select e.*,t.name topic_name from techverse.exercise_sets e join techverse.topics t on t.id=e.topic_id where e.status='PUBLISHED' order by e.published_at desc").stream().map(this::exercise).toList(); }
    @GetMapping("/exercises/{id}") public Map<String,Object> exercise(@PathVariable UUID id) { var r=exercise(db.queryForMap("select e.*,t.name topic_name from techverse.exercise_sets e join techverse.topics t on t.id=e.topic_id where e.id=? and e.status='PUBLISHED'",id)); r.put("questions", db.queryForList("select id,content,code_snippet,code_language,options,answer,explanation,position from techverse.exercise_questions where exercise_set_id=? order by position",id).stream().map(this::question).toList()); return r; }
    public record SubmitRequest(Map<String,String> answers) {}
    @PostMapping("/exercises/{id}/submit") public Map<String,Object> submit(@PathVariable UUID id,@RequestBody SubmitRequest input,HttpServletRequest request) { UUID user=requireUser(request); var qs=db.queryForList("select id,answer,explanation from techverse.exercise_questions where exercise_set_id=? order by position",id); int correct=(int)qs.stream().filter(q->Objects.equals(input.answers().get(String.valueOf(q.get("id"))),q.get("answer"))).count(); Map<String,String> explanations=qs.stream().collect(Collectors.toMap(q->String.valueOf(q.get("id")),q->String.valueOf(q.get("explanation")))); db.update("insert into techverse.exercise_attempts(user_id,exercise_set_id,attempt_snapshot,correct_count,total_count) values(?,?,?::jsonb,?,?)",user,id,toJson(input.answers()),correct,qs.size()); return Map.of("correctCount",correct,"totalCount",qs.size(),"explanations",explanations); }
    @GetMapping("/interviews") public List<Map<String,Object>> interviews(@RequestParam(required=false) UUID topicId){return db.queryForList("select i.*,t.name topic_name from techverse.interview_questions i join techverse.topics t on t.id=i.topic_id where i.status='PUBLISHED' and (cast(? as uuid) is null or i.topic_id=cast(? as uuid)) order by i.published_at desc",topicId,topicId).stream().map(this::interview).toList();}
    @GetMapping("/community/questions") public List<Map<String,Object>> questions(){return db.queryForList("select f.*,u.full_name author_name from techverse.forum_posts f join techverse.users u on u.id=f.user_id where f.parent_id is null and f.status='VISIBLE' order by f.created_at desc").stream().map(this::post).toList();}
    public record QuestionRequest(@NotBlank String title,@NotBlank String content) {}
    @PostMapping("/community/questions") public Map<String,Object> createQuestion(@Valid @RequestBody QuestionRequest input,HttpServletRequest request){UUID user=requireUser(request); UUID id=UUID.randomUUID(); db.update("insert into techverse.forum_posts(id,user_id,title,content) values(?,?,?,?)",id,user,input.title().trim(),input.content().trim()); return post(db.queryForMap("select f.*,u.full_name author_name from techverse.forum_posts f join techverse.users u on u.id=f.user_id where f.id=?",id));}

    // ----- Learner actions: lưu nội dung, enroll, hoàn thành bài học -----
    @PostMapping("/articles/{id}/save") public void saveArticle(@PathVariable UUID id,HttpServletRequest r){toggleSave("saved_articles","article_id",id,requireUser(r),true);}
    @DeleteMapping("/articles/{id}/save") public void unsaveArticle(@PathVariable UUID id,HttpServletRequest r){toggleSave("saved_articles","article_id",id,requireUser(r),false);}
    @PostMapping("/documents/{id}/save") public void saveDocument(@PathVariable UUID id,HttpServletRequest r){toggleSave("saved_documents","document_id",id,requireUser(r),true);}
    @DeleteMapping("/documents/{id}/save") public void unsaveDocument(@PathVariable UUID id,HttpServletRequest r){toggleSave("saved_documents","document_id",id,requireUser(r),false);}
    private void toggleSave(String table,String column,UUID content,UUID user,boolean save){if(save)db.update("insert into techverse."+table+"(id,user_id,"+column+") values(?,?,?) on conflict do nothing",UUID.randomUUID(),user,content);else db.update("delete from techverse."+table+" where user_id=? and "+column+"=?",user,content);}
    @PostMapping("/courses/{id}/enroll") public void enroll(@PathVariable UUID id,HttpServletRequest r){UUID user=requireUser(r); db.update("insert into techverse.course_enrollments(id,user_id,course_id,source) values(?,?,?,'FREE') on conflict do nothing",UUID.randomUUID(),user,id);}
    @PostMapping("/lessons/{id}/complete") public void completeLesson(@PathVariable UUID id,HttpServletRequest r){UUID user=requireUser(r); db.update("insert into techverse.lesson_progress(id,user_id,lesson_id) values(?,?,?) on conflict(user_id,lesson_id) do nothing",UUID.randomUUID(),user,id);}

    // ----- Mapping helpers: giữ một nơi duy nhất để chuẩn hóa response cho frontend -----
    private Map<String,Object> article(Map<String,Object> r){var x=new LinkedHashMap<String,Object>();x.put("id",r.get("id"));x.put("slug",r.get("slug"));x.put("title",r.get("title"));x.put("summary",r.get("summary"));x.put("content",r.get("content"));x.put("coverImageUrl",r.get("cover_image_url"));x.put("authorId",r.get("author_id"));x.put("authorName",r.get("author_name"));x.put("topic",Map.of("id",r.get("topic_id"),"name",r.get("topic_name"),"isActive",true));x.put("tags",List.of());x.put("status","PUBLISHED");x.put("publishedAt",r.get("published_at"));x.put("isSaved",false);return x;}
    private Map<String,Object> document(Map<String,Object> r){return out("id",r.get("id"),"authorId",r.get("author_id"),"authorName",r.get("author_name"),"title",r.get("title"),"summary",r.get("summary"),"sourceType",r.get("source_type"),"resourceUrl",r.get("resource_url"),"fileSizeBytes",r.get("file_size_bytes"),"sourceNote",r.get("source_note"),"status","PUBLISHED","publishedAt",r.get("published_at"),"isSaved",false);}
    private Map<String,Object> course(Map<String,Object> r){return out("id",r.get("id"),"authorId",r.get("author_id"),"authorName",r.get("author_name"),"title",r.get("title"),"summary",r.get("summary"),"description",r.get("description"),"level",r.get("level"),"priceAmount",r.get("price_amount"),"currency",r.get("currency"),"status","PUBLISHED","publishedAt",r.get("published_at"),"topic",out("id",r.get("topic_id"),"name",r.get("topic_name"),"isActive",true),"lessons",List.of(),"enrolled",Boolean.TRUE.equals(r.get("enrolled")));}
    private Map<String,Object> lesson(Map<String,Object> r){return out("id",r.get("id"),"courseId",r.get("course_id"),"title",r.get("title"),"content",r.get("content"),"videoUrl",r.get("video_url"),"position",r.get("position"),"completed",Boolean.TRUE.equals(r.get("completed")));}
    private Map<String,Object> exercise(Map<String,Object> r){return out("id",r.get("id"),"authorId",r.get("author_id"),"title",r.get("title"),"description",r.get("description"),"exerciseType",r.get("exercise_type"),"difficulty",r.get("difficulty"),"timeLimitSeconds",r.get("time_limit_seconds"),"topic",out("id",r.get("topic_id"),"name",r.get("topic_name"),"isActive",true),"questions",List.of());}
    private Map<String,Object> question(Map<String,Object> r){return out("id",r.get("id"),"content",r.get("content"),"codeSnippet",r.get("code_snippet"),"codeLanguage",r.get("code_language"),"options",jsonArray(r.get("options")),"answer",r.get("answer"),"explanation",r.get("explanation"),"position",r.get("position"));}
    private Map<String,Object> interview(Map<String,Object> r){return out("id",r.get("id"),"topic",out("id",r.get("topic_id"),"name",r.get("topic_name"),"isActive",true),"level",r.get("level"),"question",r.get("question"),"sampleAnswer",r.get("sample_answer"),"hint",r.get("hint"));}
    private Map<String,Object> post(Map<String,Object> r){return out("id",r.get("id"),"userId",r.get("user_id"),"authorName",r.get("author_name"),"parentId",r.get("parent_id"),"title",r.get("title"),"content",r.get("content"),"createdAt",r.get("created_at"),"status","VISIBLE");}
    private Map<String,Object> camelRow(Map<String,Object> r){return r.entrySet().stream().collect(Collectors.toMap(e->camel(e.getKey()),Map.Entry::getValue, (a,b)->b,LinkedHashMap::new));}
    private Map<String,Object> page(List<Map<String,Object>> items,int p){return Map.of("items",items,"total",items.size(),"page",p,"pageSize",items.size());}
    private String blank(String s){return s==null||s.isBlank()?null:s;}
    private Map<String,Object> out(Object... values){var map=new LinkedHashMap<String,Object>();for(int i=0;i<values.length;i+=2)map.put(String.valueOf(values[i]),values[i+1]);return map;}
    /** PostgreSQL trả JSONB dưới dạng PGobject/String; chuyển mảng đáp án đơn giản về List để frontend dùng radio options. */
    private Object jsonArray(Object value){if(value==null)return null;String raw=String.valueOf(value);if(raw==null||!raw.trim().startsWith("["))return value;String body=raw.trim().substring(1,raw.trim().length()-1).trim();if(body.isEmpty())return List.of();return Arrays.stream(body.split(",")).map(s->s.trim().replaceAll("^\\\"|\\\"$","")).toList();}
    /** Tạo JSON object tối thiểu cho snapshot attempt; key/value đều được escape trước khi lưu JSONB. */
    private String toJson(Map<String,String> values){return values.entrySet().stream().map(e->quote(e.getKey())+":"+quote(e.getValue())).collect(Collectors.joining(",","{","}"));}
    private String quote(String value){return "\""+value.replace("\\","\\\\").replace("\"","\\\"").replace("\n","\\n").replace("\r","\\r")+"\"";}
    private String camel(String s){return Arrays.stream(s.toLowerCase(Locale.ROOT).split("_")).map(String::trim).filter(x->!x.isEmpty()).reduce("",(a,b)->a.isEmpty()?b:a+Character.toUpperCase(b.charAt(0))+b.substring(1));}
}
