package com.techverse.server.repository;

import com.techverse.server.entity.Message;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.util.*;

/** Every read here is scoped to a conversation the caller already proved to be part of. */
public interface MessageRepository extends JpaRepository<Message, UUID> {
    /** A losing concurrent insert of the same (sender, client id) does nothing instead of failing the transaction. */
    @Modifying
    @Query(
            value = "INSERT INTO messages (conversation_id, sender_id, content, client_id) VALUES (:conversation, :sender, :content, :clientId)"
                    + " ON CONFLICT (sender_id, client_id) DO NOTHING",
            nativeQuery = true)
    int insert(@Param("conversation") UUID conversation, @Param("sender") UUID sender, @Param("content") String content,
            @Param("clientId") UUID clientId);

    Optional<Message> findBySenderIdAndClientId(UUID senderId, UUID clientId);

    long countByConversationIdAndSenderId(UUID conversationId, UUID senderId);

    @Query("select m from Message m where m.conversationId=:c order by m.seq desc")
    List<Message> findLatest(@Param("c") UUID conversation, Pageable pageable);

    @Query("select m from Message m where m.conversationId=:c and m.seq < :seq order by m.seq desc")
    List<Message> findBefore(@Param("c") UUID conversation, @Param("seq") long seq, Pageable pageable);

    @Query("select m from Message m where m.conversationId=:c and m.seq > :seq order by m.seq asc")
    List<Message> findAfter(@Param("c") UUID conversation, @Param("seq") long seq, Pageable pageable);

    @Query("select m from Message m where m.conversationId in :conversations and m.seq in :seqs")
    List<Message> findLast(@Param("conversations") Collection<UUID> conversations, @Param("seqs") Collection<Long> seqs);
}
