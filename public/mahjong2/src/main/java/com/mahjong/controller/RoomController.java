package com.mahjong.controller;

import com.mahjong.model.GameRoom;
import com.mahjong.model.User;
import com.mahjong.repository.GameRoomRepository;
import com.mahjong.repository.UserRepository;
import com.mahjong.service.AuthService;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/rooms")
public class RoomController {

    private final GameRoomRepository roomRepo;
    private final UserRepository userRepo;
    private final SimpMessagingTemplate ws;

    public RoomController(GameRoomRepository roomRepo, UserRepository userRepo,
                          SimpMessagingTemplate ws) {
        this.roomRepo = roomRepo;
        this.userRepo = userRepo;
        this.ws       = ws;
    }

    // ── List open rooms ───────────────────────────────────────────────
    @GetMapping
    public ResponseEntity<List<RoomDto>> listRooms() {
        var rooms = roomRepo.findByStatusOrderByCreatedAtDesc(GameRoom.RoomStatus.WAITING)
            .stream()
            .filter(r -> !r.isPrivateRoom())
            .map(this::toDto)
            .toList();
        return ResponseEntity.ok(rooms);
    }

    // ── Create room ───────────────────────────────────────────────────
    @PostMapping
    public ResponseEntity<?> createRoom(@AuthenticationPrincipal User user,
                                         @RequestBody CreateRoomRequest req) {
        var room = new GameRoom();
        room.setName(req.name() != null ? req.name() : user.getUsername() + " 的房間");
        room.setHostId(user.getId());
        room.setMode(req.mode() != null ? req.mode() : GameRoom.RoomMode.QUICK);
        room.setAiLevel(req.aiLevel() > 0 ? req.aiLevel() : 2);
        room.setPrivateRoom(req.privateRoom());
        room.getPlayerIds().add(user.getId());
        roomRepo.save(room);

        broadcastLobby();
        return ResponseEntity.ok(toDto(room));
    }

    // ── Join room ─────────────────────────────────────────────────────
    @PostMapping("/{roomId}/join")
    public ResponseEntity<?> joinRoom(@AuthenticationPrincipal User user,
                                       @PathVariable String roomId) {
        var room = roomRepo.findById(roomId)
            .orElseThrow(() -> new RuntimeException("房間不存在"));

        if (room.isFull())
            return ResponseEntity.badRequest().body(Map.of("error", "房間已滿"));
        if (room.hasPlayer(user.getId()))
            return ResponseEntity.ok(toDto(room));

        room.getPlayerIds().add(user.getId());
        roomRepo.save(room);

        // Notify room members
        ws.convertAndSend("/topic/room/" + roomId,
            Map.of("event", "PLAYER_JOINED",
                   "userId", user.getId(),
                   "username", user.getUsername(),
                   "avatarUrl", user.getAvatarUrl() != null ? user.getAvatarUrl() : ""));
        broadcastLobby();
        return ResponseEntity.ok(toDto(room));
    }

    // ── Join by invite code ───────────────────────────────────────────
    @PostMapping("/invite/{code}")
    public ResponseEntity<?> joinByCode(@AuthenticationPrincipal User user,
                                         @PathVariable String code) {
        var room = roomRepo.findByInviteCode(code.toUpperCase())
            .orElseThrow(() -> new RuntimeException("邀請碼無效"));
        if (room.isFull())
            return ResponseEntity.badRequest().body(Map.of("error", "房間已滿"));

        if (!room.hasPlayer(user.getId())) {
            room.getPlayerIds().add(user.getId());
            roomRepo.save(room);
            ws.convertAndSend("/topic/room/" + room.getId(),
                Map.of("event", "PLAYER_JOINED",
                       "userId", user.getId(),
                       "username", user.getUsername()));
        }
        return ResponseEntity.ok(toDto(room));
    }

    // ── Leave room ────────────────────────────────────────────────────
    @PostMapping("/{roomId}/leave")
    public ResponseEntity<?> leaveRoom(@AuthenticationPrincipal User user,
                                        @PathVariable String roomId) {
        var room = roomRepo.findById(roomId).orElse(null);
        if (room == null) return ResponseEntity.ok().build();

        room.getPlayerIds().remove(user.getId());
        if (room.getPlayerIds().isEmpty()) {
            roomRepo.delete(room);
        } else {
            if (user.getId().equals(room.getHostId()) && !room.getPlayerIds().isEmpty()) {
                room.setHostId(room.getPlayerIds().get(0));
            }
            roomRepo.save(room);
            ws.convertAndSend("/topic/room/" + roomId,
                Map.of("event", "PLAYER_LEFT", "userId", user.getId()));
        }
        broadcastLobby();
        return ResponseEntity.ok().build();
    }

    // ── Get room ──────────────────────────────────────────────────────
    @GetMapping("/{roomId}")
    public ResponseEntity<?> getRoom(@PathVariable String roomId) {
        return roomRepo.findById(roomId)
            .map(r -> ResponseEntity.ok(toDto(r)))
            .orElse(ResponseEntity.notFound().build());
    }

    // ── Helpers ───────────────────────────────────────────────────────
    private void broadcastLobby() {
        var rooms = roomRepo.findByStatusOrderByCreatedAtDesc(GameRoom.RoomStatus.WAITING)
            .stream().filter(r -> !r.isPrivateRoom()).map(this::toDto).toList();
        ws.convertAndSend("/topic/lobby", Map.of("rooms", rooms));
    }

    private RoomDto toDto(GameRoom r) {
        var players = r.getPlayerIds().stream()
            .map(id -> userRepo.findById(id)
                .map(u -> new PlayerInfo(u.getId(), u.getUsername(), u.getAvatarUrl(), u.getScore()))
                .orElse(null))
            .filter(p -> p != null)
            .toList();
        return new RoomDto(r.getId(), r.getName(), r.getStatus().name(), r.getMode().name(),
            r.getAiLevel(), players, r.getMaxPlayers(), r.getHostId(),
            r.isPrivateRoom(), r.getInviteCode(), r.humanCount(), r.aiCount());
    }

    // ── DTOs ─────────────────────────────────────────────────────────
    public record CreateRoomRequest(String name, GameRoom.RoomMode mode,
                                     int aiLevel, boolean privateRoom) {}

    public record PlayerInfo(String id, String username, String avatarUrl, int score) {}

    public record RoomDto(String id, String name, String status, String mode,
                           int aiLevel, List<PlayerInfo> players, int maxPlayers,
                           String hostId, boolean privateRoom, String inviteCode,
                           int humanCount, int aiCount) {}
}
