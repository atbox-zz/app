package com.mahjong.model;

public enum TileSuit {
    WAN("萬"), TONG("筒"), SUO("索"), FENG("風"), JIAN("箭"), HUA("花");

    private final String chineseName;

    TileSuit(String chineseName) { this.chineseName = chineseName; }

    public String getChineseName() { return chineseName; }

    public boolean isNumber() { return this == WAN || this == TONG || this == SUO; }

    public boolean isHonor() { return this == FENG || this == JIAN; }
}
