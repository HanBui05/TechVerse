# PROJECT: TECHVERSE – MODERN DEVELOPER LEARNING PLATFORM

## 1. PROJECT OVERVIEW

Xây dựng giao diện website học lập trình mang tên **TechVerse**, lấy cảm hứng từ ảnh giao diện JavaBuilder được cung cấp.

Website hướng tới lập trình viên, sinh viên công nghệ thông tin và những người muốn học các công nghệ hiện đại.

Yêu cầu thiết kế:
- Modern Developer Dashboard.
- Dark Mode mặc định.
- Phong cách hiện đại, chuyên nghiệp, mang hơi hướng SaaS Dashboard.
- Giao diện sạch sẽ, bố cục rõ ràng.
- Animation mượt mà, tinh tế.
- Responsive trên Desktop, Tablet và Mobile.
- Có khả năng mở rộng và tích hợp backend trong tương lai.
- Không sao chép nguyên bản JavaBuilder, cần tạo bản sắc riêng cho TechVerse.

**Quan trọng:** Đây là giai đoạn phát triển giao diện frontend. Hiện tại chưa có dữ liệu thật từ backend. Không tự tạo các khóa học hoặc bài blog giả rồi hiển thị như dữ liệu thật.

---

# 2. TECH STACK

Ưu tiên sử dụng:

- React + TypeScript
- Vite
- Tailwind CSS
- Framer Motion / Motion for React
- Lucide React Icons
- React Router
- CSS Variables cho Theme System

Yêu cầu:
- Component-based architecture.
- Clean Code.
- Reusable Components.
- Responsive Design.
- Tách biệt UI và dữ liệu.
- Dễ dàng tích hợp REST API trong tương lai.

Nếu project đã tồn tại, hãy kiểm tra cấu trúc hiện tại trước khi triển khai. Không tự ý ghi đè hoặc xóa các chức năng đang hoạt động.

---

# 3. BRAND IDENTITY

## 3.1. Website Name

**TechVerse**

Ý nghĩa: Technology + Universe.

Slogan:

"Explore Technology. Build Your Future."

## 3.2. Logo

Thiết kế logo TechVerse với biểu tượng chữ **T** cách điệu.

Yêu cầu:
- Chữ T mang phong cách công nghệ.
- Thiết kế tối giản, hiện đại.
- Có thể kết hợp các đường nét hình học hoặc cảm hứng từ mạch điện.
- Logo dễ nhận diện ở kích thước nhỏ.
- Có phiên bản icon-only và icon + wordmark.
- Logo phải hiển thị rõ trên cả Dark Mode và Light Mode.

Màu sắc gợi ý:
- Primary: #6366F1
- Secondary: #8B5CF6
- Accent: #06B6D4
- Dark Background: #0F172A
- Sidebar Background: #111827
- Card Background: #1E293B

Có thể sử dụng gradient Indigo → Purple → Cyan để tạo điểm nhấn.

Không sử dụng logo JavaBuilder.

---

# 4. MAIN LAYOUT

Giao diện chia thành hai khu vực chính:

1. Sidebar Navigation bên trái.
2. Main Content bên phải.

Sidebar cố định bên trái khi sử dụng Desktop.

Main Content chiếm toàn bộ không gian còn lại.

Giao diện phải tự động thích ứng khi Sidebar mở rộng hoặc thu gọn.

---

# 5. SIDEBAR NAVIGATION

## 5.1. Sidebar Design

Thiết kế Sidebar theo phong cách Modern Dashboard.

Chiều rộng:
- Expanded: 250px.
- Collapsed: 76px.

Sidebar có:
- Logo TechVerse ở phía trên.
- Navigation Menu.
- Settings Menu.
- Authentication Buttons ở phía dưới.

## 5.2. Sidebar Expand / Collapse

Tạo nút điều khiển ở góc trên Sidebar.

Khi nhấn:
- Expanded → Collapsed.
- Collapsed → Expanded.

Expanded Mode:
- Hiển thị icon + tên menu.
- Hiển thị đầy đủ logo TechVerse.

Collapsed Mode:
- Chỉ hiển thị icon.
- Logo chuyển thành biểu tượng chữ T.
- Hiển thị tooltip khi hover vào icon.

Animation:
- Sidebar width transition.
- Icon rotation.
- Text fade-in / fade-out.
- Main Content tự động điều chỉnh chiều rộng.

Thời gian animation khoảng 250–350ms.

Trạng thái Sidebar phải được lưu vào localStorage để giữ nguyên sau khi reload trang.

## 5.3. Navigation Items

Tạo các menu:

MAIN MENU

1. Trang chủ
   - Icon: House
   - Route: /

2. Thử thách
   - Icon: Trophy
   - Route: /challenges

3. Bảng xếp hạng
   - Icon: ChartNoAxesColumn
   - Route: /leaderboard

4. Khóa học
   - Icon: BookOpen
   - Route: /courses

5. Bài viết
   - Icon: FileText
   - Route: /blogs

6. Tài liệu & Sách
   - Icon: Library
   - Route: /resources

7. Ôn tập phỏng vấn
   - Icon: BriefcaseBusiness
   - Route: /interview

8. Hỏi đáp
   - Icon: MessageCircle
   - Route: /questions

9. Giới thiệu
   - Icon: Info
   - Route: /about

Mỗi menu phải có:
- Hover Effect.
- Active State.
- Icon Animation.
- Smooth Transition.

Active Menu sử dụng background gradient nhẹ và thanh chỉ báo ở cạnh trái.

Không cần triển khai nội dung hoàn chỉnh cho tất cả các trang ở giai đoạn này. Có thể tạo các trang placeholder với thông báo "Tính năng đang được phát triển".

---

# 6. SETTINGS – EXPANDABLE MENU

Sidebar có mục **Cài đặt (Settings)**.

Khi nhấn vào Settings:
- Menu mở rộng xuống dưới.
- Hiển thị hai submenu:
  1. Giao diện (Theme).
  2. Ngôn ngữ (Language).

Khi nhấn lần nữa:
- Menu thu gọn.

Animation:
- Smooth height transition.
- Chevron icon rotation 180°.
- Fade + slide submenu.

## 6.1. Theme Settings

Cho phép chọn:

- Dark Mode.
- Light Mode.
- System Default.

Dark Mode là giao diện mặc định khi chưa có lựa chọn được lưu.

Khi đổi Theme:
- Toàn bộ giao diện cập nhật ngay.
- Không reload trang.
- Có smooth color transition.
- Lưu lựa chọn vào localStorage.

Sử dụng CSS Variables để quản lý Theme.

## 6.2. Language Settings

Cho phép lựa chọn:
- Tiếng Việt (vi).
- English (en).

Tiếng Việt là ngôn ngữ mặc định.

Yêu cầu:
- Chuẩn bị hệ thống i18n.
- Tách nội dung dịch thành các file riêng.
- Khi đổi ngôn ngữ, toàn bộ nội dung giao diện phải thay đổi.
- Lưu lựa chọn vào localStorage.

Không cần dịch nội dung bài blog do người dùng đăng trong tương lai.

---

# 7. HOMEPAGE – HERO SECTION

Thiết kế Hero Section dựa trên bố cục của ảnh tham khảo.

Chia thành hai cột:

LEFT:
- Badge.
- Heading.
- Description.
- Technology Tags.
- Action Buttons.

RIGHT:
- Featured Blog Carousel.
- Community Cards.

Tỷ lệ gợi ý:
- Left: 55%.
- Right: 45%.

## 7.1. Hero Content

Badge:

"Welcome to TechVerse"

Main Heading:

"Khám phá thế giới công nghệ cùng TechVerse"

Highlight từ "TechVerse" bằng gradient Indigo → Purple → Cyan.

Description:

"Nền tảng học lập trình, khám phá công nghệ và phát triển kỹ năng dành cho cộng đồng lập trình viên. Từ Git, GitHub, Spring Boot, Docker đến AI — tất cả trong một hành trình."

Bên dưới hiển thị các Technology Tags:

- Git & GitHub
- Spring Boot
- Docker
- Artificial Intelligence
- Backend Development

Technology Tags có:
- Rounded Pill Design.
- Border nhẹ.
- Hover Glow.
- Smooth Animation.

## 7.2. Hero Animation

Khi trang được tải:
- Badge fade-in.
- Heading slide-up.
- Description fade-in.
- Tags xuất hiện lần lượt.
- Buttons slide-up.

Sử dụng stagger animation.

Không sử dụng animation quá mạnh gây khó chịu.

---

# 8. HERO ACTION BUTTONS

Tạo hai nút chính:

## Button 1: Khám phá khóa học

Text:

"Khám phá khóa học"

Icon: BookOpen hoặc ArrowUpRight.

Style:
- Primary Gradient Button.
- Rounded Corners.
- Subtle Shadow.
- Hover Lift.
- Glow Effect.

On Click:
- Điều hướng đến /courses.

## Button 2: Ôn tập phỏng vấn

Text:

"Ôn tập phỏng vấn"

Icon: ArrowRight.

Style:
- Secondary Button.
- Dark Surface Background.
- Subtle Border.
- Hover Border Highlight.

On Click:
- Điều hướng đến /interview.

Cả hai phải là button có chức năng thật, không phải thành phần chỉ để trang trí.

Hỗ trợ:
- Keyboard Navigation.
- Focus State.
- Hover Animation.
- Click Feedback.

---

# 9. FEATURED BLOG CAROUSEL

Đây là thành phần quan trọng nằm ở **góc trên bên phải Hero Section**, tương tự khu vực Spring WebSocket trong ảnh tham khảo.

Tuy nhiên, thay vì hiển thị một bài viết cố định, hãy xây dựng một **Featured Blog Carousel**.

Mục đích:
- Giới thiệu các bài blog nổi bật.
- Giới thiệu các công nghệ quan trọng.
- Cho phép người dùng chuyển đổi giữa các bài viết.

## 9.1. Featured Topics

Chuẩn bị danh sách chủ đề:

1. Git & GitHub
2. Spring Boot
3. Docker
4. Artificial Intelligence
5. REST API
6. Microservices
7. Database
8. Cloud Computing

Danh sách này chỉ là cấu hình chủ đề, không phải dữ liệu bài blog thật.

## 9.2. Carousel Card Design

Mỗi Slide có:

TOP:
- Blog Cover Image.

BOTTOM:
- Category.
- Blog Title.
- Short Description.
- Author.
- Read More Button.

Thiết kế:
- Rounded Card.
- Subtle Border.
- Shadow.
- Overflow Hidden.
- Smooth Hover Effect.

## 9.3. Placeholder Data

**Hiện tại chưa có dữ liệu bài blog.**

Không tự động lấy hình ảnh từ Internet.

Không sử dụng ảnh stock.

Không tạo bài viết giả.

Chuẩn bị cấu trúc dữ liệu:

```ts
interface FeaturedBlog {
  id: string;
  title: string;
  description: string;
  category: string;
  imageUrl: string | null;
  author: string | null;
  slug: string;
}
```

Dữ liệu ban đầu:

```ts
const featuredBlogs: FeaturedBlog[] = [];
```

Tạo component:

`BlogImagePlaceholder`

Khi imageUrl = null:
- Hiển thị background gradient nhẹ.
- Hiển thị icon ImageOff hoặc FileImage.
- Hiển thị dòng "Chưa có ảnh bài viết".

Khi danh sách blog rỗng:
- Hiển thị một Empty State đẹp mắt.
- Nội dung: "Các bài viết nổi bật sẽ sớm xuất hiện".
- Không hiển thị tiêu đề hoặc tác giả giả.
- Không tạo slide giả.

## 9.4. Carousel Navigation

Khi có từ hai bài viết trở lên:

Tạo:
- Previous Button.
- Next Button.
- Pagination Dots.

Previous:
- Chuyển về bài blog trước đó.

Next:
- Chuyển sang bài blog tiếp theo.

Yêu cầu:
- Có thể chuyển vòng lặp từ bài cuối về bài đầu.
- Smooth Slide Animation.
- Fade Transition.
- Hover Effects.
- Keyboard Accessible.
- Responsive.

Khi chỉ có một bài viết:
- Ẩn nút Previous / Next.
- Ẩn Pagination Dots.

Khi không có bài viết:
- Hiển thị Empty State.
- Vô hiệu hóa hoặc ẩn điều khiển chuyển slide.

Không triển khai Auto Slide ở giai đoạn này.

## 9.5. Future Backend Integration

Chuẩn bị để sau này kết nối API:

`GET /api/blogs/featured`

Khi có dữ liệu:
- Carousel tự động render bài blog.
- Ảnh lấy từ imageUrl.
- Title và Description lấy từ API.
- Read More điều hướng đến `/blogs/:slug`.

Tách logic lấy dữ liệu khỏi component giao diện.

---

# 10. COMMUNITY CARDS

Bên dưới Featured Blog Carousel tạo hai Community Cards:

1. GitHub Community
2. Discord Community

Thiết kế tương tự ảnh tham khảo:
- Small Horizontal Cards.
- Icon bên trái.
- Title và Description.
- Hover Border Effect.
- External Link Icon.

Không tự tạo link cộng đồng giả.

Sử dụng giá trị URL null cho đến khi có link chính thức.

Khi URL chưa được cấu hình, card hiển thị trạng thái "Sắp ra mắt" và không điều hướng.

---

# 11. FEATURED COURSES SECTION

Tạo Section bên dưới Hero.

Background khác nhẹ so với Hero Section để phân chia nội dung.

Heading:

"Khóa học nổi bật"

Subheading:

"Khám phá những lộ trình học tập giúp bạn nâng cao kỹ năng lập trình."

## 11.1. Course Grid

Desktop:
- 3 Cards / Row.

Tablet:
- 2 Cards / Row.

Mobile:
- 1 Card / Row.

## 11.2. Course Card Structure

Mỗi Course Card có:
- Cover Image.
- Category.
- Course Title.
- Description.
- Difficulty Level.
- View Details Button.

Tuy nhiên, hiện tại chưa có dữ liệu khóa học.

Không tự tạo khóa học giả.

## 11.3. Empty State

Khai báo:

```ts
interface Course {
  id: string;
  title: string;
  description: string;
  category: string;
  level: string;
  imageUrl: string | null;
  slug: string;
}
```

Dữ liệu ban đầu:

```ts
const featuredCourses: Course[] = [];
```

Khi danh sách rỗng:
- Giữ nguyên tiêu đề Section.
- Hiển thị Empty State ở giữa.
- Sử dụng icon BookOpen.
- Text: "Các khóa học đang được cập nhật".
- Subtitle: "Hãy quay lại sau để khám phá những khóa học mới nhất."

Không render các Course Cards giả.

Khi có dữ liệu:
- Render Course Grid.
- Nếu imageUrl = null thì hiển thị Image Placeholder.
- Khi click Course Card sẽ điều hướng đến `/courses/:slug`.

---

# 12. ANIMATION SYSTEM

Sử dụng Motion for React hoặc Framer Motion.

Các animation cần triển khai:

## Sidebar
- Expand / Collapse.
- Text Fade.
- Icon Transition.
- Active Indicator.

## Settings
- Accordion Expand.
- Chevron Rotation.
- Submenu Slide Down.

## Hero
- Fade In.
- Slide Up.
- Staggered Elements.

## Buttons
- Hover Lift.
- Scale on Tap.
- Glow Effect.

## Blog Carousel
- Horizontal Slide Transition.
- Image Fade.
- Pagination Animation.

## Course Cards
- Hover Lift.
- Border Glow.
- Image Zoom nhẹ khi hover.

## Page Transition
- Fade In.
- Smooth Route Transition.

Animation duration:
- Micro interactions: 150–200ms.
- Sidebar: 250–350ms.
- Page Transition: 300–400ms.
- Carousel: 350–500ms.

Hỗ trợ `prefers-reduced-motion` để giảm animation khi người dùng yêu cầu.

Ưu tiên hiệu năng, hạn chế các hiệu ứng nặng gây giảm FPS.

---

# 13. RESPONSIVE DESIGN

## Desktop (>= 1280px)

- Sidebar cố định.
- Hero hai cột.
- Blog Carousel bên phải.
- Courses Grid ba cột.

## Tablet (768px – 1279px)

- Sidebar có thể thu gọn.
- Hero tự điều chỉnh bố cục.
- Courses Grid hai cột.

## Mobile (< 768px)

- Sidebar chuyển thành Drawer.
- Có nút Hamburger Menu.
- Drawer có Overlay.
- Click Overlay để đóng Sidebar.
- Hero chuyển thành một cột.
- Carousel nằm dưới Hero Text.
- Buttons có kích thước phù hợp màn hình.
- Courses Grid một cột.

Không để nội dung tràn ngang màn hình.

---

# 14. COMPONENT ARCHITECTURE

Tổ chức các component theo cấu trúc (dựa trên cấu trúc thư mục hiện tại, không xóa bất kì thư mục nào hiện có, có thể tạo thư mục mới):

```text
src/
│
├── assets/
│   └── logo/
│
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── SidebarItem.tsx
│   │   ├── SidebarSettings.tsx
│   │   ├── MainLayout.tsx
│   │   └── MobileNavigation.tsx
│   │
│   ├── home/
│   │   ├── HeroSection.tsx
│   │   ├── HeroActions.tsx
│   │   ├── TechnologyTags.tsx
│   │   ├── FeaturedBlogCarousel.tsx
│   │   ├── BlogSlide.tsx
│   │   ├── CommunityCards.tsx
│   │   └── FeaturedCourses.tsx
│   │
│   ├── common/
│   │   ├── Button.tsx
│   │   ├── EmptyState.tsx
│   │   ├── ImagePlaceholder.tsx
│   │   └── SectionHeading.tsx
│
├── pages/
│   ├── HomePage.tsx
│   ├── CoursesPage.tsx
│   ├── InterviewPage.tsx
│   └── NotFoundPage.tsx
│
├── hooks/
│   ├── useSidebar.ts
│   ├── useTheme.ts
│   └── useLanguage.ts
│
├── contexts/
│   ├── ThemeContext.tsx
│   └── LanguageContext.tsx
│
├── data/
│   ├── navigation.ts
│   ├── featuredBlogs.ts
│   └── featuredCourses.ts
│
├── services/
│   ├── blogService.ts
│   └── courseService.ts
│
├── types/
│   ├── blog.ts
│   └── course.ts
│
├── locales/
│   ├── vi.json
│   └── en.json
│
├── styles/
│   └── globals.css
│
├── App.tsx
└── main.tsx
```

Có thể điều chỉnh cấu trúc dựa trên project thực tế nhưng phải giữ tính modular.

---

# 15. UI / UX REQUIREMENTS

Yêu cầu tổng thể:

- Thiết kế đẹp, hiện đại và chuyên nghiệp.
- Có sự nhất quán về typography.
- Sử dụng font Inter.
- Spacing hợp lý.
- Border Radius thống nhất.
- Không sử dụng quá nhiều màu.
- Dark Mode phải có độ tương phản tốt.
- Buttons có trạng thái Hover / Active / Focus.
- Sidebar hoạt động mượt mà.
- Không có horizontal overflow.
- Không có broken images.
- Không có console errors.
- Không có dead buttons.
- Không sử dụng dữ liệu giả làm dữ liệu thật.

Ưu tiên:
- Accessibility.
- Performance.
- Maintainability.
- Reusability.

---

# 16. IMPLEMENTATION PHASES

Triển khai theo thứ tự:

PHASE 1:
- Kiểm tra project.
- Thiết lập Design System.
- Tạo logo TechVerse.
- Thiết lập Theme System.
- Thiết lập Language System.

PHASE 2:
- Xây dựng Sidebar.
- Expand / Collapse.
- Navigation.
- Settings Accordion.
- Responsive Drawer.

PHASE 3:
- Xây dựng Hero Section.
- Heading.
- Technology Tags.
- Action Buttons.
- Entrance Animations.

PHASE 4:
- Xây dựng Featured Blog Carousel.
- Image Placeholder.
- Previous / Next.
- Pagination Dots.
- Empty State.
- Chuẩn bị API Integration.

PHASE 5:
- Xây dựng Featured Courses Section.
- Course Grid.
- Course Card.
- Empty State.

PHASE 6:
- Responsive Optimization.
- Animation Refinement.
- Accessibility.
- Performance Optimization.
- Testing.

---

# 17. ACCEPTANCE CRITERIA

Hoàn thành khi:

1. Logo TechVerse hiển thị chính xác.
2. Sidebar có thể mở rộng và thu gọn.
3. Main Content tự động thay đổi theo Sidebar.
4. Settings có thể expand/collapse.
5. Theme có thể chuyển Dark / Light / System.
6. Language có thể chuyển Vietnamese / English.
7. Button "Khám phá khóa học" hoạt động.
8. Button "Ôn tập phỏng vấn" hoạt động.
9. Featured Blog Carousel hỗ trợ chuyển slide khi có dữ liệu.
10. Carousel hiển thị Empty State khi không có dữ liệu.
11. Featured Courses không hiển thị dữ liệu giả.
12. Course Image hỗ trợ null.
13. Giao diện responsive.
14. Animation hoạt động mượt.
15. Không có lỗi TypeScript.
16. Không có lỗi runtime.
17. Dữ liệu và giao diện được tách biệt.
18. Có thể tích hợp backend trong tương lai.

---

# FINAL INSTRUCTION

Hãy triển khai giao diện TechVerse hoàn chỉnh dựa trên các yêu cầu trên.

Ưu tiên độ hoàn thiện của UI/UX, khả năng mở rộng và chất lượng code.

Sử dụng ảnh JavaBuilder được cung cấp trong thư mục references/javabuilder_home.png làm tham khảo về bố cục, nhưng tạo phong cách thiết kế riêng cho TechVerse.

Không tự ý thêm những tính năng phức tạp nằm ngoài phạm vi yêu cầu.

Không tạo nội dung blog hoặc khóa học giả.

Khi hoàn thành:
- Tóm tắt những component đã tạo.
- Liệt kê các route đã triển khai.
- Hướng dẫn chạy project.
- Xác nhận các tính năng đã kiểm tra.
- Nêu rõ những phần đang chờ dữ liệu backend.