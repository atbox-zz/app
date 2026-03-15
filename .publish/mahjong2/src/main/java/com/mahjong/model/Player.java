package com.mahjong.model;

import java.util.ArrayList;
import java.util.List;

public class Player {
    private String id;
    private String name;
    private PlayerType type;
    private int aiLevel;          // 1-4
    private List<Tile> hand = new ArrayList<>();
    private List<MeldGroup> exposed = new ArrayList<>();
    private List<Tile> flowers = new ArrayList<>();
    private List<Tile> discards = new ArrayList<>();
    private int score = 30000;
    private Wind wind;
    private boolean dealer;
    private boolean isTenpai;
    private int seatIndex;        // 0=East,1=South,2=West,3=North in this round

    public Player() {}

    public Player(String id, String name, PlayerType type, int aiLevel) {
        this.id = id;
        this.name = name;
        this.type = type;
        this.aiLevel = aiLevel;
    }

    public boolean isHuman() { return type == PlayerType.HUMAN; }
    public boolean isAI()    { return type == PlayerType.AI; }

    /** Count of all tiles in hand + exposed (excluding flowers) */
    public int totalTiles() {
        int from_exposed = exposed.stream().mapToInt(m -> m.getType() == MeldType.QUAD ? 4 : 3).sum();
        return hand.size() + from_exposed;
    }

    // ── Getters / Setters ────────────────────────────────────────────
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public PlayerType getType() { return type; }
    public void setType(PlayerType type) { this.type = type; }
    public int getAiLevel() { return aiLevel; }
    public void setAiLevel(int aiLevel) { this.aiLevel = aiLevel; }
    public List<Tile> getHand() { return hand; }
    public void setHand(List<Tile> hand) { this.hand = hand; }
    public List<MeldGroup> getExposed() { return exposed; }
    public void setExposed(List<MeldGroup> exposed) { this.exposed = exposed; }
    public List<Tile> getFlowers() { return flowers; }
    public void setFlowers(List<Tile> flowers) { this.flowers = flowers; }
    public List<Tile> getDiscards() { return discards; }
    public void setDiscards(List<Tile> discards) { this.discards = discards; }
    public int getScore() { return score; }
    public void setScore(int score) { this.score = score; }
    public Wind getWind() { return wind; }
    public void setWind(Wind wind) { this.wind = wind; }
    public boolean isDealer() { return dealer; }
    public void setDealer(boolean dealer) { this.dealer = dealer; }
    public boolean isTenpai() { return isTenpai; }
    public void setTenpai(boolean tenpai) { isTenpai = tenpai; }
    public int getSeatIndex() { return seatIndex; }
    public void setSeatIndex(int seatIndex) { this.seatIndex = seatIndex; }
}
