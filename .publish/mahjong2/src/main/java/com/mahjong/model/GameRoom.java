package com.mahjong.model;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "game_rooms")
public class GameRoom {

    public enum RoomStatus { WAITING, PLAYING, FINISHED }
    public enum RoomMode   { QUICK, STANDARD, FULL }

    @Id
    @Column(length = 36)
    private String id = UUID.randomUUID().toString();

    private String name;

    @Enumerated(EnumType.STRING)
    private RoomStatus status = RoomStatus.WAITING;

    @Enumerated(EnumType.STRING)
    private RoomMode mode = RoomMode.QUICK;

    private int aiLevel = 2;
    private int maxPlayers = 4;

    @ElementCollection
    @CollectionTable(name = "room_players")
    private List<String> playerIds = new ArrayList<>();   // user ids

    private String hostId;
    private String gameStateJson;   // serialized GameState

    private Instant createdAt = Instant.now();
    private boolean privateRoom = false;
    private String inviteCode;

    public GameRoom() {
        this.inviteCode = UUID.randomUUID().toString().substring(0, 6).toUpperCase();
    }

    public boolean isFull()    { return playerIds.size() >= maxPlayers; }
    public boolean hasPlayer(String uid) { return playerIds.contains(uid); }
    public int humanCount()    { return playerIds.size(); }
    public int aiCount()       { return maxPlayers - playerIds.size(); }

    // Getters / Setters
    public String getId() { return id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public RoomStatus getStatus() { return status; }
    public void setStatus(RoomStatus status) { this.status = status; }
    public RoomMode getMode() { return mode; }
    public void setMode(RoomMode mode) { this.mode = mode; }
    public int getAiLevel() { return aiLevel; }
    public void setAiLevel(int aiLevel) { this.aiLevel = aiLevel; }
    public int getMaxPlayers() { return maxPlayers; }
    public void setMaxPlayers(int maxPlayers) { this.maxPlayers = maxPlayers; }
    public List<String> getPlayerIds() { return playerIds; }
    public void setPlayerIds(List<String> playerIds) { this.playerIds = playerIds; }
    public String getHostId() { return hostId; }
    public void setHostId(String hostId) { this.hostId = hostId; }
    public String getGameStateJson() { return gameStateJson; }
    public void setGameStateJson(String gameStateJson) { this.gameStateJson = gameStateJson; }
    public Instant getCreatedAt() { return createdAt; }
    public boolean isPrivateRoom() { return privateRoom; }
    public void setPrivateRoom(boolean privateRoom) { this.privateRoom = privateRoom; }
    public String getInviteCode() { return inviteCode; }
    public void setInviteCode(String inviteCode) { this.inviteCode = inviteCode; }
}
