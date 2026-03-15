package com.mahjong.controller;

import com.mahjong.model.ChatMessage;
import com.mahjong.model.User;
import org.springframework.messaging.handler.annotation.*;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.annotation.SubscribeMapping;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Controller
public class WebSocketController {

    private final SimpMessagingTemplate ws;

    // Track who is in which room: roomId -> Set<userId>
    private final Map<String, Set<String>> roomPresence = new ConcurrentHashMap<>();
    // Track userId -> username for display
    private final Map<String, String> userNames = new ConcurrentHashMap<>();

    public WebSocketController(SimpMessagingTemplate ws) {
        this.ws = ws;
    }

    // ── Text Chat ─────────────────────────────────────────────────────
    @MessageMapping("/room/{roomId}/chat")
    public void handleChat(@DestinationVariable String roomId,
                            @Payload ChatMessage msg,
                            Principal principal) {
        msg.setRoomId(roomId);
        msg.setSenderId(principal.getName());
        if (msg.getSenderName() == null)
            msg.setSenderName(userNames.getOrDefault(principal.getName(), "玩家"));

        ws.convertAndSend("/topic/room/" + roomId + "/chat", msg);
    }

    // ── WebRTC Signaling (Video / Voice) ─────────────────────────────
    // SDP offer/answer and ICE candidates routed peer-to-peer via server
    @MessageMapping("/room/{roomId}/signal")
    public void handleSignal(@DestinationVariable String roomId,
                              @Payload ChatMessage signal,
                              Principal principal) {
        signal.setSenderId(principal.getName());
        String targetId = signal.getTargetId();

        if (targetId != null) {
            // Point-to-point: deliver to specific user
            ws.convertAndSendToUser(targetId, "/queue/signal", signal);
        } else {
            // Broadcast to all in room (e.g. new peer announcement)
            ws.convertAndSend("/topic/room/" + roomId + "/signal", signal);
        }
    }

    // ── Room Presence ─────────────────────────────────────────────────
    @MessageMapping("/room/{roomId}/join")
    public void joinRoom(@DestinationVariable String roomId,
                          @Payload Map<String, String> payload,
                          Principal principal) {
        String userId   = principal.getName();
        String username = payload.getOrDefault("username", "玩家");
        String avatar   = payload.getOrDefault("avatarUrl", "");

        userNames.put(userId, username);
        roomPresence.computeIfAbsent(roomId, k -> ConcurrentHashMap.newKeySet()).add(userId);

        // Notify others in room
        ws.convertAndSend("/topic/room/" + roomId + "/presence",
            Map.of("event", "JOIN",
                   "userId", userId,
                   "username", username,
                   "avatarUrl", avatar,
                   "peers", roomPresence.getOrDefault(roomId, Set.of())));
    }

    @MessageMapping("/room/{roomId}/leave")
    public void leaveRoom(@DestinationVariable String roomId, Principal principal) {
        String userId = principal.getName();
        var peers = roomPresence.get(roomId);
        if (peers != null) {
            peers.remove(userId);
            if (peers.isEmpty()) roomPresence.remove(roomId);
        }
        ws.convertAndSend("/topic/room/" + roomId + "/presence",
            Map.of("event", "LEAVE", "userId", userId));
    }

    // ── Game Action relay (broadcast game state to room) ─────────────
    @MessageMapping("/room/{roomId}/game")
    public void handleGameEvent(@DestinationVariable String roomId,
                                 @Payload Map<String, Object> event,
                                 Principal principal) {
        event.put("senderId", principal.getName());
        ws.convertAndSend("/topic/room/" + roomId + "/game", event);
    }
}
