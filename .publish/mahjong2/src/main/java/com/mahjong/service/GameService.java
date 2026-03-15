package com.mahjong.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.mahjong.ai.AIEngine;
import com.mahjong.model.*;
import com.mahjong.repository.GameRoomRepository;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class GameService {

    private final TileFactory tileFactory;
    private final WinChecker winChecker;
    private final ScoreCalculator scoreCalc;
    private final ShantenCalculator shantenCalc;
    private final AIEngine aiEngine;
    private final GameRoomRepository roomRepo;
    private final SimpMessagingTemplate ws;
    private final ObjectMapper mapper = new ObjectMapper();

    // In-memory active games: roomId -> GameState
    private final Map<String, GameState> games = new ConcurrentHashMap<>();

    public GameService(TileFactory tileFactory, WinChecker winChecker,
                       ScoreCalculator scoreCalc, ShantenCalculator shantenCalc,
                       AIEngine aiEngine, GameRoomRepository roomRepo,
                       SimpMessagingTemplate ws) {
        this.tileFactory  = tileFactory;
        this.winChecker   = winChecker;
        this.scoreCalc    = scoreCalc;
        this.shantenCalc  = shantenCalc;
        this.aiEngine     = aiEngine;
        this.roomRepo     = roomRepo;
        this.ws           = ws;
    }

    // ── Start game for a room ──────────────────────────────────────────
    public GameState startGame(String roomId, List<String> humanPlayerIds,
                                List<String> humanNames, int aiLevel, int totalRounds) {
        GameState state = new GameState();
        state.setGameId(roomId);
        state.setTotalRounds(totalRounds);
        state.setRound(1);
        state.setDealerIndex(0);
        state.setRoundWind(Wind.EAST);

        List<Player> players = new ArrayList<>();
        // Add human players first (up to 4)
        for (int i = 0; i < Math.min(humanPlayerIds.size(), 4); i++) {
            var p = new Player(humanPlayerIds.get(i),
                humanNames.size() > i ? humanNames.get(i) : "玩家" + (i+1),
                PlayerType.HUMAN, 0);
            players.add(p);
        }
        // Fill remaining slots with AI
        while (players.size() < 4) {
            int idx = players.size();
            players.add(new Player("ai_" + idx, "AI " + idx, PlayerType.AI, aiLevel));
        }
        state.setPlayers(players);

        startRound(state);
        games.put(roomId, state);
        broadcastGameState(roomId, state);
        return state;
    }

    // ── Single-player shortcut (backwards compat) ─────────────────────
    public GameState startSinglePlayer(int aiLevel, int totalRounds) {
        String id = UUID.randomUUID().toString().substring(0, 8);
        return startGame(id, List.of("p0"), List.of("玩家"), aiLevel, totalRounds);
    }

    // ── Player action ─────────────────────────────────────────────────
    public GameState performAction(String roomId, String playerId, PlayerAction action) {
        var state  = games.get(roomId);
        if (state == null) throw new IllegalArgumentException("Game not found");

        int playerIdx = findPlayerIdx(state, playerId);
        if (playerIdx < 0) throw new IllegalArgumentException("Player not in game");

        Player player = state.getPlayers().get(playerIdx);

        switch (action.getType()) {
            case DISCARD       -> handleDiscard(state, playerIdx, findById(player.getHand(), action.getTileId()));
            case CHI           -> handleChi(state, playerIdx, action.getChiTileIds());
            case PENG          -> handlePeng(state, playerIdx);
            case GANG          -> handleGang(state, playerIdx);
            case AN_GANG       -> handleAnGang(state, playerIdx, findById(player.getHand(), action.getTileId()));
            case WIN           -> handleWin(state, playerIdx, false);
            case SELF_DRAW_WIN -> handleWin(state, playerIdx, true);
            case PASS          -> handlePass(state, playerIdx);
            default            -> state.setMessage("未知動作");
        }

        runAITurns(state);
        broadcastGameState(roomId, state);
        return buildView(state, playerIdx);
    }

    public GameState getState(String roomId, String playerId) {
        var state = games.get(roomId);
        if (state == null) throw new IllegalArgumentException("Game not found");
        int idx = findPlayerIdx(state, playerId);
        return buildView(state, Math.max(idx, 0));
    }

    public GameState nextRound(String roomId) {
        var state = games.get(roomId);
        if (state == null) throw new IllegalArgumentException("Game not found");

        if (state.getRound() >= state.getTotalRounds()) {
            state.setPhase(GamePhase.GAME_OVER);
        } else {
            state.setRound(state.getRound() + 1);
            state.setDealerIndex((state.getDealerIndex() + 1) % 4);
            if (state.getRound() % 4 == 1 && state.getRound() > 1)
                state.setRoundWind(state.getRoundWind().next());
            startRound(state);
            runAITurns(state);
        }
        broadcastGameState(roomId, state);
        return state;
    }

    // ── Round setup ───────────────────────────────────────────────────
    private void startRound(GameState state) {
        for (int i = 0; i < 4; i++) {
            var p = state.getPlayers().get(i);
            p.getHand().clear(); p.getExposed().clear();
            p.getFlowers().clear(); p.getDiscards().clear();
            p.setTenpai(false); p.setDealer(i == state.getDealerIndex());
            p.setSeatIndex(i);
            Wind[] winds = {Wind.EAST, Wind.SOUTH, Wind.WEST, Wind.NORTH};
            p.setWind(winds[(i - state.getDealerIndex() + 4) % 4]);
        }
        state.setWall(tileFactory.createShuffled());
        state.setWallIndex(0); state.setGangsCount(0);
        state.setLastDiscard(null); state.setLastDiscardPlayerIndex(-1);
        state.setWinnerIndex(-1); state.setExhaustiveDraw(false);
        state.setLastWinResult(null); state.setAvailableActions(new ArrayList<>());
        state.setPhase(GamePhase.DEALING);

        for (int i = 0; i < 4; i++) deal13(state, state.getPlayers().get(i));
        state.setCurrentPlayerIndex(state.getDealerIndex());
        state.setPhase(GamePhase.PLAYING);
        drawForPlayer(state, state.getDealerIndex());
    }

    private void deal13(GameState state, Player p) {
        for (int i = 0; i < 13; i++) {
            Tile t = state.drawFromWall();
            if (t != null && t.isFlower()) { p.getFlowers().add(t); t = state.drawFromWall(); }
            if (t != null) p.getHand().add(t);
        }
        sortHand(p);
    }

    private void drawForPlayer(GameState state, int idx) {
        if (state.isWallEmpty()) { exhaustiveDraw(state); return; }
        var p = state.getPlayers().get(idx);
        Tile t = state.drawFromWall();
        while (t != null && t.isFlower()) { p.getFlowers().add(t); t = state.drawFromWall(); }
        if (t == null) { exhaustiveDraw(state); return; }
        p.getHand().add(t); sortHand(p);
        state.setCurrentPlayerIndex(idx);
        state.setPhase(GamePhase.PLAYING);
        computeDrawActions(state, idx, t);
    }

    private void computeDrawActions(GameState state, int idx, Tile drawn) {
        var p = state.getPlayers().get(idx);
        var actions = new ArrayList<ActionType>();
        actions.add(ActionType.DISCARD);
        if (winChecker.canWin(p.getHand(), p.getExposed())) {
            var wr = winChecker.analyzeWin(p.getHand(), p.getExposed(), drawn, true, p.getWind(), state.getRoundWind());
            if (wr.meetsMinimum()) actions.add(ActionType.SELF_DRAW_WIN);
        }
        if (aiEngine.decideAnGang(p, state) != null) actions.add(ActionType.AN_GANG);
        state.setAvailableActions(actions);
    }

    private void computeDiscardActions(GameState state, Tile discard, int discardedBy) {
        state.setLastDiscard(discard);
        state.setLastDiscardPlayerIndex(discardedBy);
        state.setPhase(GamePhase.AWAITING_CLAIM);

        // Compute for each human player
        for (int i = 0; i < 4; i++) {
            if (i == discardedBy) continue;
            var p = state.getPlayers().get(i);
            if (!p.isHuman()) continue;

            var actions = new ArrayList<ActionType>();
            actions.add(ActionType.PASS);
            var test14 = new ArrayList<>(p.getHand()); test14.add(discard);
            if (winChecker.canWin(test14, p.getExposed())) {
                var wr = winChecker.analyzeWin(test14, p.getExposed(), discard, false, p.getWind(), state.getRoundWind());
                if (wr.meetsMinimum()) actions.add(ActionType.WIN);
            }
            long cnt = p.getHand().stream().filter(t -> t.equals(discard)).count();
            if (cnt >= 2) actions.add(ActionType.PENG);
            if (cnt >= 3) actions.add(ActionType.GANG);
            int next = (discardedBy + 1) % 4;
            if (i == next && discard.getSuit().isNumber()) {
                if (!findChiOpts(p.getHand(), discard).isEmpty()) actions.add(ActionType.CHI);
            }
            // Store per-player actions in message for now
            // In full impl, use per-player state
        }
        state.setAvailableActions(List.of(ActionType.PASS, ActionType.WIN, ActionType.PENG, ActionType.GANG, ActionType.CHI));
    }

    // ── Action handlers (same as v1) ──────────────────────────────────
    private void handleDiscard(GameState state, int idx, Tile tile) {
        var p = state.getPlayers().get(idx);
        if (tile == null) tile = p.getHand().get(p.getHand().size()-1);
        p.getHand().remove(tile);
        p.getDiscards().add(tile);
        state.setMessage(p.getName() + " 打出 " + tile.getDisplayNameInternal());
        computeDiscardActions(state, tile, idx);
    }

    private void handleChi(GameState state, int idx, List<String> handIds) {
        var p = state.getPlayers().get(idx);
        var discard = state.getLastDiscard();
        var handTiles = new ArrayList<Tile>();
        for (var id : handIds) {
            var t = findById(p.getHand(), id);
            if (t != null) { handTiles.add(t); p.getHand().remove(t); }
        }
        var meld = new ArrayList<>(handTiles); meld.add(discard);
        meld.sort(Comparator.comparingInt(Tile::toIndex));
        p.getExposed().add(MeldGroup.sequence(meld, state.getLastDiscardPlayerIndex()));
        state.setMessage(p.getName() + " 吃！");
        state.setPhase(GamePhase.PLAYING);
        state.setAvailableActions(List.of(ActionType.DISCARD));
        state.setCurrentPlayerIndex(idx);
    }

    private void handlePeng(GameState state, int idx) {
        var p = state.getPlayers().get(idx);
        var discard = state.getLastDiscard();
        var tiles = new ArrayList<Tile>(); int removed = 0;
        for (int i = 0; i < p.getHand().size() && removed < 2; i++) {
            if (p.getHand().get(i).equals(discard)) { tiles.add(p.getHand().remove(i--)); removed++; }
        }
        tiles.add(discard);
        p.getExposed().add(MeldGroup.triplet(tiles, state.getLastDiscardPlayerIndex()));
        state.setMessage(p.getName() + " 碰！");
        state.setPhase(GamePhase.PLAYING);
        state.setAvailableActions(List.of(ActionType.DISCARD));
        state.setCurrentPlayerIndex(idx);
    }

    private void handleGang(GameState state, int idx) {
        var p = state.getPlayers().get(idx);
        var discard = state.getLastDiscard();
        var tiles = new ArrayList<Tile>();
        for (int i = 0; i < p.getHand().size(); ) {
            if (p.getHand().get(i).equals(discard)) tiles.add(p.getHand().remove(i)); else i++;
        }
        tiles.add(discard);
        p.getExposed().add(MeldGroup.quad(tiles, false, state.getLastDiscardPlayerIndex()));
        state.setMessage(p.getName() + " 槓！");
        drawFromDead(state, idx);
    }

    private void handleAnGang(GameState state, int idx, Tile tile) {
        if (tile == null) return;
        var p = state.getPlayers().get(idx);
        var tiles = new ArrayList<Tile>();
        for (int i = 0; i < p.getHand().size(); ) {
            if (p.getHand().get(i).equals(tile)) tiles.add(p.getHand().remove(i)); else i++;
        }
        if (tiles.size() < 4) { p.getHand().addAll(tiles); return; }
        p.getExposed().add(MeldGroup.quad(tiles, true, -1));
        state.setMessage(p.getName() + " 暗槓！");
        drawFromDead(state, idx);
    }

    private void drawFromDead(GameState state, int idx) {
        var t = state.drawFromDeadWall();
        if (t == null) { exhaustiveDraw(state); return; }
        var p = state.getPlayers().get(idx);
        if (t.isFlower()) { p.getFlowers().add(t); t = state.drawFromDeadWall(); }
        if (t == null) { exhaustiveDraw(state); return; }
        p.getHand().add(t); sortHand(p);
        state.setCurrentPlayerIndex(idx);
        state.setPhase(GamePhase.PLAYING);
        computeDrawActions(state, idx, t);
    }

    private void handleWin(GameState state, int idx, boolean selfDraw) {
        var winner = state.getPlayers().get(idx);
        var winTile = selfDraw ? winner.getHand().get(winner.getHand().size()-1) : state.getLastDiscard();
        var result  = winChecker.analyzeWin(winner.getHand(), winner.getExposed(),
            winTile, selfDraw, winner.getWind(), state.getRoundWind());
        if (!result.isWon() || !result.meetsMinimum()) {
            state.setMessage("⚠️ 番數不足 8 番"); return;
        }
        state.setWinnerIndex(idx);
        state.setLastWinResult(result);
        scoreCalc.applyWin(state, idx, result);
        state.setPhase(GamePhase.SETTLEMENT);
        state.setMessage(winner.getName() + " 胡牌！" + result.getTotalFan() + " 番");
    }

    private void handlePass(GameState state, int idx) {
        int next = (state.getLastDiscardPlayerIndex() + 1) % 4;
        state.setPhase(GamePhase.PLAYING);
        state.setCurrentPlayerIndex(next);
        drawForPlayer(state, next);
    }

    private void exhaustiveDraw(GameState state) {
        state.setExhaustiveDraw(true);
        state.setPhase(GamePhase.SETTLEMENT);
        for (var p : state.getPlayers()) p.setTenpai(!winChecker.getWaitingTiles(p.getHand(), p.getExposed()).isEmpty());
        scoreCalc.applyExhaustiveDraw(state);
        state.setMessage("流局！");
    }

    // ── AI turns ──────────────────────────────────────────────────────
    private void runAITurns(GameState state) {
        int safety = 0;
        while (safety++ < 100) {
            if (state.getPhase() == GamePhase.SETTLEMENT || state.getPhase() == GamePhase.GAME_OVER) break;
            if (state.getPhase() == GamePhase.AWAITING_CLAIM) {
                // Check if any human needs to decide — if so, stop
                boolean humanHasChoice = state.getPlayers().stream()
                    .filter(Player::isHuman)
                    .anyMatch(p -> {
                        int pi = state.getPlayers().indexOf(p);
                        return pi != state.getLastDiscardPlayerIndex();
                    });
                if (humanHasChoice) break;
                if (!resolveAIClaims(state)) {
                    int next = (state.getLastDiscardPlayerIndex() + 1) % 4;
                    state.setPhase(GamePhase.PLAYING);
                    state.setCurrentPlayerIndex(next);
                    drawForPlayer(state, next);
                }
                continue;
            }
            if (state.getPhase() == GamePhase.PLAYING) {
                int cur = state.getCurrentPlayerIndex();
                if (state.getPlayers().get(cur).isHuman()) break;
                playAITurn(state, cur);
            }
        }
    }

    private boolean resolveAIClaims(GameState state) {
        var discard = state.getLastDiscard();
        int discBy  = state.getLastDiscardPlayerIndex();
        if (discard == null) return false;
        for (int priority = 0; priority < 4; priority++) {
            for (int i = 0; i < 4; i++) {
                if (i == discBy) continue;
                var ai = state.getPlayers().get(i);
                if (!ai.isAI()) continue;
                if (priority == 0) {
                    var test = new ArrayList<>(ai.getHand()); test.add(discard);
                    if (winChecker.canWin(test, ai.getExposed())) {
                        var wr = winChecker.analyzeWin(test, ai.getExposed(), discard, false, ai.getWind(), state.getRoundWind());
                        if (wr.meetsMinimum()) { ai.getHand().add(discard); handleWin(state, i, false); return true; }
                    }
                } else if (priority == 1 && aiEngine.decideGang(ai, discard, state)) {
                    state.setCurrentPlayerIndex(i); handleGang(state, i); return true;
                } else if (priority == 2 && aiEngine.decidePeng(ai, discard, state)) {
                    state.setCurrentPlayerIndex(i); handlePeng(state, i);
                    handleDiscard(state, i, aiEngine.chooseDiscard(ai, state)); return true;
                } else if (priority == 3 && i == (discBy+1)%4) {
                    var chi = aiEngine.decideChi(ai, discard, state);
                    if (chi != null && !chi.isEmpty()) {
                        state.setCurrentPlayerIndex(i);
                        handleChi(state, i, chi.stream().map(Tile::getId).toList());
                        handleDiscard(state, i, aiEngine.chooseDiscard(ai, state)); return true;
                    }
                }
            }
        }
        return false;
    }

    private void playAITurn(GameState state, int idx) {
        var ai = state.getPlayers().get(idx);
        var gang = aiEngine.decideAnGang(ai, state);
        if (gang != null) { handleAnGang(state, idx, gang); return; }
        if (winChecker.canWin(ai.getHand(), ai.getExposed())) {
            var wr = winChecker.analyzeWin(ai.getHand(), ai.getExposed(),
                ai.getHand().get(ai.getHand().size()-1), true, ai.getWind(), state.getRoundWind());
            if (wr.meetsMinimum()) { handleWin(state, idx, true); return; }
        }
        var discard = aiEngine.chooseDiscard(ai, state);
        if (discard != null) handleDiscard(state, idx, discard);
    }

    // ── View building & broadcast ─────────────────────────────────────
    private GameState buildView(GameState state, int viewerIdx) {
        for (int i = 0; i < state.getPlayers().size(); i++) {
            boolean hidden = (i != viewerIdx) && (state.getPhase() != GamePhase.SETTLEMENT);
            for (var t : state.getPlayers().get(i).getHand()) t.setHidden(hidden);
            for (var t : state.getPlayers().get(i).getDiscards()) t.setHidden(false);
            for (var m : state.getPlayers().get(i).getExposed()) m.getTiles().forEach(t -> t.setHidden(false));
            for (var t : state.getPlayers().get(i).getFlowers()) t.setHidden(false);
        }
        if (state.getLastDiscard() != null) state.getLastDiscard().setHidden(false);
        return state;
    }

    private void broadcastGameState(String roomId, GameState state) {
        // Broadcast full (hidden) state to room topic
        ws.convertAndSend("/topic/room/" + roomId + "/game-state",
            Map.of("type", "GAME_STATE_UPDATE", "phase", state.getPhase().name(),
                   "message", state.getMessage(), "currentPlayer", state.getCurrentPlayerIndex(),
                   "remainingTiles", state.getRemainingTiles(),
                   "winnerIndex", state.getWinnerIndex()));
    }

    // ── Helpers ───────────────────────────────────────────────────────
    private int findPlayerIdx(GameState state, String playerId) {
        for (int i = 0; i < state.getPlayers().size(); i++)
            if (state.getPlayers().get(i).getId().equals(playerId)) return i;
        return -1;
    }

    private Tile findById(List<Tile> hand, String id) {
        if (id == null) return null;
        return hand.stream().filter(t -> id.equals(t.getId())).findFirst().orElse(null);
    }

    private void sortHand(Player p) {
        p.getHand().sort(Comparator.comparingInt(Tile::toIndex));
    }

    private List<List<Tile>> findChiOpts(List<Tile> hand, Tile discard) {
        var opts = new ArrayList<List<Tile>>();
        if (!discard.getSuit().isNumber()) return opts;
        int v = discard.getValue(); var s = discard.getSuit();
        int[][] pats = {{v-2,v-1},{v-1,v+1},{v+1,v+2}};
        for (var pat : pats) {
            if (pat[0]<1||pat[1]>9) continue;
            var t1 = hand.stream().filter(t->t.getSuit()==s&&t.getValue()==pat[0]).findFirst().orElse(null);
            var t2 = hand.stream().filter(t->t.getSuit()==s&&t.getValue()==pat[1]&&t!=t1).findFirst().orElse(null);
            if (t1!=null&&t2!=null) opts.add(List.of(t1,t2));
        }
        return opts;
    }

    public GameState getStateById(String roomId) { return games.get(roomId); }
}
