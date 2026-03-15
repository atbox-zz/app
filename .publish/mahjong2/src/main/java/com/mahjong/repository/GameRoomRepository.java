package com.mahjong.repository;

import com.mahjong.model.GameRoom;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface GameRoomRepository extends JpaRepository<GameRoom, String> {
    List<GameRoom> findByStatusOrderByCreatedAtDesc(GameRoom.RoomStatus status);
    Optional<GameRoom> findByInviteCode(String inviteCode);
}
