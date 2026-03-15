package com.mahjong.service;

import com.mahjong.ai.AIEngine;
import com.mahjong.model.*;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
public class GameService {

    private final TileFactory tileFactory;
    private final WinChecker winChecker;
    private final ScoreCalculator scoreCalc;
    private final ShantenCalculator shantenCalc;
    private final AIEngine aiEngine;

    // In-memory game store
    private final Map<String, GameState> games = new ConcurrentHashMap<>();

    public GameService(TileFactory tileFactory, WinChecker winChecker,
                       ScoreCalculator scoreCalc, ShantenCalculator shantenCalc,
                       AIEngine aiEngine) {
        this.tileFactory  = tileFactory;
        this.winChecker   = winChecker;
        this.scoreCalc    = scoreCalc;
        this.shantenCalc  = shantenCalc;
        this.aiEngine     = aiEngine;
    }

    // ── Public API ────────────────────────────────────────────────────

    public GameState startGame(int aiLevel, int totalRounds) {
        GameState state = new GameState();
        state.setGameId(UUID.randomUUID().toString().substring(0, 8));
        state.setTotalRounds(totalRounds);
        state.setRound(1);
        state.setDealerIndex(0);
        state.setRoundWind(Wind.EAST);

        // Create players: seat 0 = human, 1-3 = AI
        List<Player> players = new ArrayList<>();
        players.add(new Player("p0", "玩家", PlayerType.HUMAN, 0));
        players.add(new Player("p1", "東家 AI", PlayerType.AI, aiLevel));
        players.add(new Player("p2", "南家 AI", PlayerType.AI, aiLevel));
        players.add(new Player("p3", "西家 AI", PlayerType.AI, aiLevel));
        state.setPlayers(players);

        startRound(state);
        games.put(state.getGameId(), state);
        return buildClientView(state, 0);
    }

    public GameState getState(String gameId) {
        GameState state = games.get(gameId);
        if (state == null) throw new IllegalArgumentException("Game not found: " + gameId);
        return buildClientView(state, 0);
    }

    public GameState performAction(String gameId, PlayerAction action) {
        GameState state = games.get(gameId);
        if (state == null) throw new IllegalArgumentException("Game not found: " + gameId);

        Player human = state.getPlayers().get(0);

        switch (action.getType()) {
            case DISCARD     -> handleDiscard(state, 0, findTileById(human.getHand(), action.getTileId()));
            case CHI         -> handleChi(state, 0, action.getChiTileIds());
            case PENG        -> handlePeng(state, 0);
            case GANG        -> handleGang(state, 0);
            case AN_GANG     -> handleAnGang(state, 0, findTileById(human.getHand(), action.getTileId()));
            case WIN         -> handleWin(state, 0, false);
            case SELF_DRAW_WIN -> handleWin(state, 0, true);
            case PASS        -> handlePass(state, 0);
            default          -> state.setMessage("未知動作");
        }

        // After human action, let AIs act
        runAITurns(state);

        return buildClientView(state, 0);
    }

    public GameState nextRound(String gameId) {
        GameState state = games.get(gameId);
        if (state == null) throw new IllegalArgumentException("Game not found");

        if (state.getRound() >= state.getTotalRounds()) {
            state.setPhase(GamePhase.GAME_OVER);
        } else {
            state.setRound(state.getRound() + 1);
            // Rotate dealer
            int nextDealer = (state.getDealerIndex() + 1) % 4;
            state.setDealerIndex(nextDealer);
            // Advance round wind every 4 rounds
            if (state.getRound() % 4 == 1 && state.getRound() > 1) {
                state.setRoundWind(state.getRoundWind().next());
            }
            startRound(state);
            runAITurns(state);
        }
        return buildClientView(state, 0);
    }

    // ── Round setup ───────────────────────────────────────────────────

    private void startRound(GameState state) {
        // Reset player round state
        List<Player> players = state.getPlayers();
        for (int i = 0; i < 4; i++) {
            Player p = players.get(i);
            p.getHand().clear();
            p.getExposed().clear();
            p.getFlowers().clear();
            p.getDiscards().clear();
            p.setTenpai(false);
            p.setDealer(i == state.getDealerIndex());
            p.setSeatIndex(i);
            Wind[] winds = {Wind.EAST, Wind.SOUTH, Wind.WEST, Wind.NORTH};
            p.setWind(winds[(i - state.getDealerIndex() + 4) % 4]);
        }

        // Shuffle and set wall
        state.setWall(tileFactory.createShuffled());
        state.setWallIndex(0);
        state.setGangsCount(0);
        state.setLastDiscard(null);
        state.setLastDiscardPlayerIndex(-1);
        state.setWinnerIndex(-1);
        state.setExhaustiveDraw(false);
        state.setLastWinResult(null);
        state.setAvailableActions(new ArrayList<>());
        state.setPhase(GamePhase.DEALING);

        // Deal 13 tiles to each player, handle flowers
        for (int i = 0; i < 4; i++) {
            deal13(state, players.get(i));
        }

        // Dealer draws the 14th tile
        state.setCurrentPlayerIndex(state.getDealerIndex());
        state.setPhase(GamePhase.PLAYING);
        drawTileForPlayer(state, state.getDealerIndex());
    }

    private void deal13(GameState state, Player player) {
        for (int i = 0; i < 13; i++) {
            Tile t = state.drawFromWall();
            if (t != null) {
                if (t.isFlower()) {
                    player.getFlowers().add(t);
                    // Draw replacement
                    t = state.drawFromWall();
                }
                if (t != null) player.getHand().add(t);
            }
        }
        sortHand(player);
    }

    // ── Turn management ───────────────────────────────────────────────

    private void drawTileForPlayer(GameState state, int playerIdx) {
        if (state.isWallEmpty()) {
            exhaustiveDraw(state);
            return;
        }
        Player player = state.getPlayers().get(playerIdx);
        Tile drawn = state.drawFromWall();
        if (drawn == null) { exhaustiveDraw(state); return; }

        // Handle flower
        while (drawn != null && drawn.isFlower()) {
            player.getFlowers().add(drawn);
            state.setMessage(player.getName() + " 補花 " + drawn.getDisplayNameInternal());
            drawn = state.drawFromWall();
        }
        if (drawn == null) { exhaustiveDraw(state); return; }

        player.getHand().add(drawn);
        sortHand(player);
        state.setCurrentPlayerIndex(playerIdx);
        state.setPhase(GamePhase.PLAYING);

        // Compute available actions for this player
        computeActionsAfterDraw(state, playerIdx, drawn);
    }

    private void computeActionsAfterDraw(GameState state, int playerIdx, Tile drawn) {
        Player player = state.getPlayers().get(playerIdx);
        List<ActionType> actions = new ArrayList<>();

        // Can always discard (unless immediate win)
        actions.add(ActionType.DISCARD);

        // Check self-draw win
        if (winChecker.canWin(player.getHand(), player.getExposed())) {
            WinResult wr = winChecker.analyzeWin(player.getHand(), player.getExposed(),
                drawn, true, player.getWind(), state.getRoundWind());
            if (wr.meetsMinimum()) actions.add(ActionType.SELF_DRAW_WIN);
        }

        // Check an-gang (暗槓)
        Tile gangTile = aiEngine.decideAnGang(player, state);
        if (gangTile != null) actions.add(ActionType.AN_GANG);

        state.setAvailableActions(actions);
        state.setMessage(player.getName() + " 的回合，請選擇動作。");
    }

    private void computeActionsAfterDiscard(GameState state, Tile discard, int discardedBy) {
        // Other players may chi/peng/gang/win
        // This is resolved from the "claiming" perspective
        state.setLastDiscard(discard);
        state.setLastDiscardPlayerIndex(discardedBy);
        state.setPhase(GamePhase.AWAITING_CLAIM);

        // Pre-compute what the human player (idx 0) can do
        if (discardedBy != 0) {
            Player human = state.getPlayers().get(0);
            List<ActionType> actions = new ArrayList<>();
            actions.add(ActionType.PASS);

            // Win (ron)
            List<Tile> test14 = new ArrayList<>(human.getHand());
            test14.add(discard);
            if (winChecker.canWin(test14, human.getExposed())) {
                WinResult wr = winChecker.analyzeWin(test14, human.getExposed(),
                    discard, false, human.getWind(), state.getRoundWind());
                if (wr.meetsMinimum()) actions.add(ActionType.WIN);
            }

            // Peng
            long cnt = human.getHand().stream().filter(t -> t.equals(discard)).count();
            if (cnt >= 2) actions.add(ActionType.PENG);

            // Gang
            if (cnt >= 3) actions.add(ActionType.GANG);

            // Chi (only next player in turn order can chi)
            int nextPlayer = (discardedBy + 1) % 4;
            if (nextPlayer == 0) {
                // Human is the next player, can chi
                if (!findChiOptionsStatic(human.getHand(), discard).isEmpty()) actions.add(ActionType.CHI);
            }

            state.setAvailableActions(actions);
        } else {
            state.setAvailableActions(List.of()); // human just discarded, AIs will act
        }
    }

    // ── Action handlers ───────────────────────────────────────────────

    private void handleDiscard(GameState state, int playerIdx, Tile tile) {
        if (tile == null) {
            // Discard last drawn tile as fallback
            Player p = state.getPlayers().get(playerIdx);
            tile = p.getHand().get(p.getHand().size() - 1);
        }
        Player player = state.getPlayers().get(playerIdx);
        player.getHand().remove(tile);
        player.getDiscards().add(tile);
        state.setMessage(player.getName() + " 打出 " + tile.getDisplayNameInternal());
        computeActionsAfterDiscard(state, tile, playerIdx);
    }

    private void handleChi(GameState state, int playerIdx, List<String> handTileIds) {
        Player player = state.getPlayers().get(playerIdx);
        Tile discard = state.getLastDiscard();
        if (discard == null) return;

        List<Tile> handTiles = new ArrayList<>();
        for (String id : handTileIds) {
            Tile t = findTileById(player.getHand(), id);
            if (t != null) { handTiles.add(t); player.getHand().remove(t); }
        }
        List<Tile> meldTiles = new ArrayList<>(handTiles);
        meldTiles.add(discard);
        meldTiles.sort(Comparator.comparingInt(Tile::toIndex));
        player.getExposed().add(MeldGroup.sequence(meldTiles, state.getLastDiscardPlayerIndex()));

        state.setMessage(player.getName() + " 吃！");
        state.setPhase(GamePhase.PLAYING);
        state.setAvailableActions(List.of(ActionType.DISCARD));
        state.setCurrentPlayerIndex(playerIdx);
    }

    private void handlePeng(GameState state, int playerIdx) {
        Player player = state.getPlayers().get(playerIdx);
        Tile discard = state.getLastDiscard();
        if (discard == null) return;

        List<Tile> pengTiles = new ArrayList<>();
        int removed = 0;
        for (int i = 0; i < player.getHand().size() && removed < 2; i++) {
            if (player.getHand().get(i).equals(discard)) {
                pengTiles.add(player.getHand().get(i));
                player.getHand().remove(i--);
                removed++;
            }
        }
        pengTiles.add(discard);
        player.getExposed().add(MeldGroup.triplet(pengTiles, state.getLastDiscardPlayerIndex()));

        state.setMessage(player.getName() + " 碰！");
        state.setPhase(GamePhase.PLAYING);
        state.setAvailableActions(List.of(ActionType.DISCARD));
        state.setCurrentPlayerIndex(playerIdx);
    }

    private void handleGang(GameState state, int playerIdx) {
        Player player = state.getPlayers().get(playerIdx);
        Tile discard = state.getLastDiscard();
        if (discard == null) return;

        List<Tile> gangTiles = new ArrayList<>();
        for (int i = 0; i < player.getHand().size(); ) {
            if (player.getHand().get(i).equals(discard)) {
                gangTiles.add(player.getHand().get(i));
                player.getHand().remove(i);
            } else i++;
        }
        gangTiles.add(discard);
        player.getExposed().add(MeldGroup.quad(gangTiles, false, state.getLastDiscardPlayerIndex()));

        state.setMessage(player.getName() + " 槓！");
        // Draw from dead wall
        drawFromDeadWall(state, playerIdx);
    }

    private void handleAnGang(GameState state, int playerIdx, Tile tile) {
        if (tile == null) return;
        Player player = state.getPlayers().get(playerIdx);

        List<Tile> gangTiles = new ArrayList<>();
        for (int i = 0; i < player.getHand().size(); ) {
            if (player.getHand().get(i).equals(tile)) {
                gangTiles.add(player.getHand().get(i));
                player.getHand().remove(i);
            } else i++;
        }
        if (gangTiles.size() < 4) { player.getHand().addAll(gangTiles); return; }
        player.getExposed().add(MeldGroup.quad(gangTiles, true, -1));

        state.setMessage(player.getName() + " 暗槓！");
        drawFromDeadWall(state, playerIdx);
    }

    private void drawFromDeadWall(GameState state, int playerIdx) {
        Tile supplement = state.drawFromDeadWall();
        if (supplement == null) { exhaustiveDraw(state); return; }

        Player player = state.getPlayers().get(playerIdx);
        if (supplement.isFlower()) {
            player.getFlowers().add(supplement);
            supplement = state.drawFromDeadWall();
        }
        if (supplement == null) { exhaustiveDraw(state); return; }

        player.getHand().add(supplement);
        sortHand(player);
        state.setCurrentPlayerIndex(playerIdx);
        state.setPhase(GamePhase.PLAYING);
        computeActionsAfterDraw(state, playerIdx, supplement);
    }

    private void handleWin(GameState state, int playerIdx, boolean selfDraw) {
        Player winner = state.getPlayers().get(playerIdx);

        WinResult result = winChecker.analyzeWin(
            winner.getHand(), winner.getExposed(),
            selfDraw ? winner.getHand().get(winner.getHand().size() - 1) : state.getLastDiscard(),
            selfDraw, winner.getWind(), state.getRoundWind());

        if (!result.isWon()) {
            state.setMessage("⚠️ 無法胡牌（不符合條件）");
            return;
        }
        if (!result.meetsMinimum()) {
            state.setMessage("⚠️ 番數不足 8 番，無法胡牌");
            return;
        }

        state.setWinnerIndex(playerIdx);
        state.setLastWinResult(result);
        scoreCalc.applyWin(state, playerIdx, result);

        state.setPhase(GamePhase.SETTLEMENT);
        state.setMessage(winner.getName() + " 胡牌！" + result.getTotalFan() + " 番");
    }

    private void handlePass(GameState state, int playerIdx) {
        // Human passes, let AIs claim
        state.setMessage("玩家 過。");
        // Turn moves to next player after discarder
        int nextPlayer = (state.getLastDiscardPlayerIndex() + 1) % 4;
        if (nextPlayer == state.getLastDiscardPlayerIndex()) nextPlayer = (nextPlayer + 1) % 4;
        state.setPhase(GamePhase.PLAYING);
        state.setCurrentPlayerIndex(nextPlayer);
        drawTileForPlayer(state, nextPlayer);
    }

    // ── AI auto-play ──────────────────────────────────────────────────

    private void runAITurns(GameState state) {
        if (state.getPhase() == GamePhase.SETTLEMENT ||
            state.getPhase() == GamePhase.GAME_OVER) return;

        int safety = 0; // prevent infinite loops
        while (safety++ < 100) {
            if (state.getPhase() == GamePhase.SETTLEMENT ||
                state.getPhase() == GamePhase.GAME_OVER) break;

            if (state.getPhase() == GamePhase.AWAITING_CLAIM) {
                // Human is player 0; if human needs to decide, stop
                if (state.getLastDiscardPlayerIndex() != 0 &&
                    !state.getAvailableActions().isEmpty() &&
                    state.getAvailableActions().stream().anyMatch(a -> a != ActionType.PASS)) {
                    break; // Human has non-trivial choices
                }
                // AIs claim check (players 1-3)
                if (!resolveAIClaims(state)) {
                    // No AI claimed; advance to next player
                    int next = (state.getLastDiscardPlayerIndex() + 1) % 4;
                    state.setPhase(GamePhase.PLAYING);
                    state.setCurrentPlayerIndex(next);
                    drawTileForPlayer(state, next);
                }
                continue;
            }

            if (state.getPhase() == GamePhase.PLAYING) {
                int cur = state.getCurrentPlayerIndex();
                if (cur == 0) break; // Human turn
                playAITurn(state, cur);
            }
        }
    }

    /** AIs check if they want to claim the last discard. Returns true if someone claimed. */
    private boolean resolveAIClaims(GameState state) {
        Tile discard = state.getLastDiscard();
        int discardedBy = state.getLastDiscardPlayerIndex();
        if (discard == null) return false;

        // Priority: WIN > GANG > PENG > CHI
        // Check in priority order
        for (int priority = 0; priority < 4; priority++) {
            for (int i = 1; i < 4; i++) { // AI players only
                if (i == discardedBy) continue;
                Player ai = state.getPlayers().get(i);
                if (!ai.isAI()) continue;

                if (priority == 0) {
                    // Win check
                    List<Tile> test = new ArrayList<>(ai.getHand());
                    test.add(discard);
                    if (winChecker.canWin(test, ai.getExposed())) {
                        WinResult wr = winChecker.analyzeWin(test, ai.getExposed(),
                            discard, false, ai.getWind(), state.getRoundWind());
                        if (wr.meetsMinimum()) {
                            ai.getHand().add(discard);
                            handleWin(state, i, false);
                            return true;
                        }
                    }
                } else if (priority == 1 && aiEngine.decideGang(ai, discard, state)) {
                    state.setCurrentPlayerIndex(i);
                    handleGang(state, i);
                    return true;
                } else if (priority == 2 && aiEngine.decidePeng(ai, discard, state)) {
                    state.setCurrentPlayerIndex(i);
                    handlePeng(state, i);
                    // AI immediately discards
                    Tile toDiscard = aiEngine.chooseDiscard(ai, state);
                    handleDiscard(state, i, toDiscard);
                    return true;
                } else if (priority == 3) {
                    // Chi: only the next player
                    int nextPlayer = (discardedBy + 1) % 4;
                    if (i == nextPlayer) {
                        List<Tile> chiTiles = aiEngine.decideChi(ai, discard, state);
                        if (chiTiles != null && !chiTiles.isEmpty()) {
                            state.setCurrentPlayerIndex(i);
                            // Build handTileIds
                            List<String> ids = chiTiles.stream().map(Tile::getId).toList();
                            handleChi(state, i, ids);
                            // AI immediately discards
                            Tile toDiscard = aiEngine.chooseDiscard(ai, state);
                            handleDiscard(state, i, toDiscard);
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }

    private void playAITurn(GameState state, int playerIdx) {
        Player ai = state.getPlayers().get(playerIdx);

        // Check an-gang
        Tile gangTile = aiEngine.decideAnGang(ai, state);
        if (gangTile != null) {
            handleAnGang(state, playerIdx, gangTile);
            return;
        }

        // Check self-draw win
        if (winChecker.canWin(ai.getHand(), ai.getExposed())) {
            WinResult wr = winChecker.analyzeWin(ai.getHand(), ai.getExposed(),
                ai.getHand().get(ai.getHand().size() - 1), true, ai.getWind(), state.getRoundWind());
            if (wr.meetsMinimum()) {
                handleWin(state, playerIdx, true);
                return;
            }
        }

        // Discard
        Tile toDiscard = aiEngine.chooseDiscard(ai, state);
        if (toDiscard != null) handleDiscard(state, playerIdx, toDiscard);
    }

    // ── Exhaustive draw (流局) ────────────────────────────────────────

    private void exhaustiveDraw(GameState state) {
        state.setExhaustiveDraw(true);
        state.setPhase(GamePhase.SETTLEMENT);
        // Mark tenpai players
        for (Player p : state.getPlayers()) {
            List<Tile> waits = winChecker.getWaitingTiles(p.getHand(), p.getExposed());
            p.setTenpai(!waits.isEmpty());
        }
        scoreCalc.applyExhaustiveDraw(state);
        state.setMessage("流局！牌堆耗盡");
    }

    // ── View building ─────────────────────────────────────────────────

    /** Build a client-facing view that hides other players' hand tiles */
    private GameState buildClientView(GameState state, int humanIdx) {
        // We'll just mark non-human hands as hidden
        for (int i = 0; i < state.getPlayers().size(); i++) {
            Player p = state.getPlayers().get(i);
            boolean hidden = (i != humanIdx) && (state.getPhase() != GamePhase.SETTLEMENT);
            for (Tile t : p.getHand()) t.setHidden(hidden);

            // 棄牌、面子、花牌永遠公開
            for (Tile t : p.getDiscards()) t.setHidden(false);
            for (MeldGroup m : p.getExposed()) m.getTiles().forEach(t -> t.setHidden(false));
            for (Tile t : p.getFlowers()) t.setHidden(false);
        }

        // lastDiscard 永遠公開 棄牌區的牌也要確保不被隱藏
        if (state.getLastDiscard() != null) {
            state.getLastDiscard().setHidden(false);
        }

        return state;
    }

    // ── Utilities ─────────────────────────────────────────────────────

    private List<List<Tile>> findChiOptionsStatic(List<Tile> hand, Tile discard) {
        List<List<Tile>> opts = new ArrayList<>();
        if (!discard.getSuit().isNumber()) return opts;
        int v = discard.getValue();
        TileSuit s = discard.getSuit();
        int[][] patterns = {{v-2,v-1},{v-1,v+1},{v+1,v+2}};
        for (int[] pat : patterns) {
            if (pat[0] < 1 || pat[1] > 9) continue;
            Tile t1 = hand.stream().filter(t -> t.getSuit()==s && t.getValue()==pat[0]).findFirst().orElse(null);
            Tile t2 = hand.stream().filter(t -> t.getSuit()==s && t.getValue()==pat[1] && t!=t1).findFirst().orElse(null);
            if (t1 != null && t2 != null) opts.add(List.of(t1, t2));
        }
        return opts;
    }

    private Tile findTileById(List<Tile> hand, String id) {
        if (id == null) return null;
        return hand.stream().filter(t -> id.equals(t.getId())).findFirst().orElse(null);
    }

    private void sortHand(Player player) {
        player.getHand().sort(Comparator.comparingInt(Tile::toIndex));
    }
}
