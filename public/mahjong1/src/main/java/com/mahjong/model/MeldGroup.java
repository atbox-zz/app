package com.mahjong.model;

import java.util.List;

public class MeldGroup {
    private MeldType type;
    private List<Tile> tiles;
    private boolean concealed;   // 暗槓
    private int fromPlayerIndex; // -1 = self

    public MeldGroup() {}

    public MeldGroup(MeldType type, List<Tile> tiles, boolean concealed, int fromPlayerIndex) {
        this.type = type;
        this.tiles = tiles;
        this.concealed = concealed;
        this.fromPlayerIndex = fromPlayerIndex;
    }

    public static MeldGroup sequence(List<Tile> tiles, int fromPlayer) {
        return new MeldGroup(MeldType.SEQUENCE, tiles, false, fromPlayer);
    }

    public static MeldGroup triplet(List<Tile> tiles, int fromPlayer) {
        return new MeldGroup(MeldType.TRIPLET, tiles, false, fromPlayer);
    }

    public static MeldGroup quad(List<Tile> tiles, boolean concealed, int fromPlayer) {
        return new MeldGroup(MeldType.QUAD, tiles, concealed, fromPlayer);
    }

    // Getters/Setters
    public MeldType getType() { return type; }
    public void setType(MeldType type) { this.type = type; }
    public List<Tile> getTiles() { return tiles; }
    public void setTiles(List<Tile> tiles) { this.tiles = tiles; }
    public boolean isConcealed() { return concealed; }
    public void setConcealed(boolean concealed) { this.concealed = concealed; }
    public int getFromPlayerIndex() { return fromPlayerIndex; }
    public void setFromPlayerIndex(int fromPlayerIndex) { this.fromPlayerIndex = fromPlayerIndex; }
}
