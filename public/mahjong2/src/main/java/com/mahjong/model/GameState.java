package com.mahjong.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import java.util.ArrayList;
import java.util.List;

public class GameState {
    private String gameId;
    private GamePhase phase = GamePhase.SETUP;
    private int round;
    private int totalRounds;        // e.g. 4 / 8 / 16
    private int dealerIndex;
    private Wind roundWind = Wind.EAST;

    private List<Tile> wall = new ArrayList<>();
    private int wallIndex;          // next draw position
    private int deadWallEnd;        // last 14 tiles = seabed area

    private int currentPlayerIndex;
    private Tile lastDiscard;
    private int lastDiscardPlayerIndex = -1;
    private List<ActionType> availableActions = new ArrayList<>();

    private List<Player> players = new ArrayList<>();

    private String message = "";
    private WinResult lastWinResult;
    private int winnerIndex = -1;
    private boolean exhaustiveDraw;  // 流局

    private int gangsCount;          // total declared kans this round

    // ── Helpers ──────────────────────────────────────────────────────

    public int getRemainingTiles() {
        return Math.max(0, wall.size() - wallIndex);
    }

    public boolean isWallEmpty() {
        return wallIndex >= wall.size() - 14;  // keep 14 as dead wall
    }

    public Tile drawFromWall() {
        if (isWallEmpty()) return null;
        return wall.get(wallIndex++);
    }

    public Tile drawFromDeadWall() {
        int deadStart = wall.size() - 14;
        if (gangsCount > 3) return null;
        Tile t = wall.get(deadStart + gangsCount);
        gangsCount++;
        return t;
    }

    // ── Getters / Setters ────────────────────────────────────────────
    public String getGameId() { return gameId; }
    public void setGameId(String gameId) { this.gameId = gameId; }
    public GamePhase getPhase() { return phase; }
    public void setPhase(GamePhase phase) { this.phase = phase; }
    public int getRound() { return round; }
    public void setRound(int round) { this.round = round; }
    public int getTotalRounds() { return totalRounds; }
    public void setTotalRounds(int totalRounds) { this.totalRounds = totalRounds; }
    public int getDealerIndex() { return dealerIndex; }
    public void setDealerIndex(int dealerIndex) { this.dealerIndex = dealerIndex; }
    public Wind getRoundWind() { return roundWind; }
    public void setRoundWind(Wind roundWind) { this.roundWind = roundWind; }
    @JsonIgnore
    public List<Tile> getWall() { return wall; }
    public void setWall(List<Tile> wall) { this.wall = wall; }
    public int getWallIndex() { return wallIndex; }
    public void setWallIndex(int wallIndex) { this.wallIndex = wallIndex; }
    public int getDeadWallEnd() { return deadWallEnd; }
    public void setDeadWallEnd(int deadWallEnd) { this.deadWallEnd = deadWallEnd; }
    public int getCurrentPlayerIndex() { return currentPlayerIndex; }
    public void setCurrentPlayerIndex(int currentPlayerIndex) { this.currentPlayerIndex = currentPlayerIndex; }
    public Tile getLastDiscard() { return lastDiscard; }
    public void setLastDiscard(Tile lastDiscard) { this.lastDiscard = lastDiscard; }
    public int getLastDiscardPlayerIndex() { return lastDiscardPlayerIndex; }
    public void setLastDiscardPlayerIndex(int lastDiscardPlayerIndex) { this.lastDiscardPlayerIndex = lastDiscardPlayerIndex; }
    public List<ActionType> getAvailableActions() { return availableActions; }
    public void setAvailableActions(List<ActionType> availableActions) { this.availableActions = availableActions; }
    public List<Player> getPlayers() { return players; }
    public void setPlayers(List<Player> players) { this.players = players; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public WinResult getLastWinResult() { return lastWinResult; }
    public void setLastWinResult(WinResult lastWinResult) { this.lastWinResult = lastWinResult; }
    public int getWinnerIndex() { return winnerIndex; }
    public void setWinnerIndex(int winnerIndex) { this.winnerIndex = winnerIndex; }
    public boolean isExhaustiveDraw() { return exhaustiveDraw; }
    public void setExhaustiveDraw(boolean exhaustiveDraw) { this.exhaustiveDraw = exhaustiveDraw; }
    public int getGangsCount() { return gangsCount; }
    public void setGangsCount(int gangsCount) { this.gangsCount = gangsCount; }
}
