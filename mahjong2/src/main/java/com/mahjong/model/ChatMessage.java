package com.mahjong.model;

import java.time.Instant;

public class ChatMessage {

    public enum Type { TEXT, SYSTEM, GAME_EVENT, VOICE_SIGNAL, VIDEO_SIGNAL }

    private Type type = Type.TEXT;
    private String roomId;
    private String senderId;
    private String senderName;
    private String senderAvatar;
    private String content;
    private Instant timestamp = Instant.now();

    // WebRTC signaling fields
    private String targetId;    // for peer-to-peer signals
    private Object signal;      // SDP / ICE candidate

    public ChatMessage() {}

    public static ChatMessage system(String roomId, String content) {
        var m = new ChatMessage();
        m.type = Type.SYSTEM;
        m.roomId = roomId;
        m.content = content;
        return m;
    }

    public static ChatMessage gameEvent(String roomId, String content) {
        var m = new ChatMessage();
        m.type = Type.GAME_EVENT;
        m.roomId = roomId;
        m.content = content;
        return m;
    }

    // Getters / Setters
    public Type getType() { return type; }
    public void setType(Type type) { this.type = type; }
    public String getRoomId() { return roomId; }
    public void setRoomId(String roomId) { this.roomId = roomId; }
    public String getSenderId() { return senderId; }
    public void setSenderId(String senderId) { this.senderId = senderId; }
    public String getSenderName() { return senderName; }
    public void setSenderName(String senderName) { this.senderName = senderName; }
    public String getSenderAvatar() { return senderAvatar; }
    public void setSenderAvatar(String senderAvatar) { this.senderAvatar = senderAvatar; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public Instant getTimestamp() { return timestamp; }
    public String getTargetId() { return targetId; }
    public void setTargetId(String targetId) { this.targetId = targetId; }
    public Object getSignal() { return signal; }
    public void setSignal(Object signal) { this.signal = signal; }
}
