package com.mahjong.model;

import java.util.ArrayList;
import java.util.List;

public class WinResult {
    private boolean won;
    private List<FanItem> fanList = new ArrayList<>();
    private int totalFan;
    private int baseScore;    // 底分
    private boolean selfDraw;
    private boolean sevenPairs;
    private boolean specialHand;
    private String specialHandName;

    // ── Helpers ──────────────────────────────────────────────────────

    public void addFan(String name, int fan) {
        fanList.add(new FanItem(name, fan));
        totalFan += fan;
    }

    public boolean meetsMinimum() { return totalFan >= 8; }

    // ── Getters / Setters ────────────────────────────────────────────
    public boolean isWon() { return won; }
    public void setWon(boolean won) { this.won = won; }
    public List<FanItem> getFanList() { return fanList; }
    public void setFanList(List<FanItem> fanList) { this.fanList = fanList; }
    public int getTotalFan() { return totalFan; }
    public void setTotalFan(int totalFan) { this.totalFan = totalFan; }
    public int getBaseScore() { return baseScore; }
    public void setBaseScore(int baseScore) { this.baseScore = baseScore; }
    public boolean isSelfDraw() { return selfDraw; }
    public void setSelfDraw(boolean selfDraw) { this.selfDraw = selfDraw; }
    public boolean isSevenPairs() { return sevenPairs; }
    public void setSevenPairs(boolean sevenPairs) { this.sevenPairs = sevenPairs; }
    public boolean isSpecialHand() { return specialHand; }
    public void setSpecialHand(boolean specialHand) { this.specialHand = specialHand; }
    public String getSpecialHandName() { return specialHandName; }
    public void setSpecialHandName(String specialHandName) { this.specialHandName = specialHandName; }
}
