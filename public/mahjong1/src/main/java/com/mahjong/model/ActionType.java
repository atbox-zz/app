package com.mahjong.model;

public enum ActionType {
    DRAW("摸牌"),
    DISCARD("打牌"),
    CHI("吃"),
    PENG("碰"),
    GANG("明槓"),
    AN_GANG("暗槓"),
    JIA_GANG("加槓"),
    WIN("胡牌"),
    SELF_DRAW_WIN("自摸"),
    PASS("過");

    private final String chineseName;
    ActionType(String n) { this.chineseName = n; }
    public String getChineseName() { return chineseName; }
}
