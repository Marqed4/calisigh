package com.zachery.customcalendar.Assistant;

import com.zachery.customcalendar.Storage.Database;

import java.util.List;
import java.util.logging.Level;
import java.util.logging.Logger;

import com.google.gson.Gson;

import static spark.Spark.delete;
import static spark.Spark.get;
import static spark.Spark.post;
import static spark.Spark.put;

/* Saved chat sessions */
public class ChatHistory {

    private static final Logger LOGGER = Logger.getLogger(ChatHistory.class.getName());

    private final Gson gson = new Gson();

    public void register() {
        // Past sessions, newest first
        get("/api/chat/sessions", (req, res) -> {
            res.type("application/json");
            try {
                return gson.toJson(Database.get().listChatSessions());
            } catch (Exception e) {
                return fail(res, "GET /api/chat/sessions failed", e);
            }
        });

        post("/api/chat/sessions", (req, res) -> {
            res.type("application/json");
            try {
                return gson.toJson(new Created(Database.get().createChatSession()));
            } catch (Exception e) {
                return fail(res, "POST /api/chat/sessions failed", e);
            }
        });

        get("/api/chat/sessions/:id", (req, res) -> {
            res.type("application/json");
            try {
                long id = Long.parseLong(req.params(":id"));
                Database.ChatSessionRow session = Database.get().getChatSession(id);
                if (session == null) {
                    res.status(404);
                    return gson.toJson(new Error("Session not found."));
                }
                return gson.toJson(new SessionWithMessages(session, Database.get().getChatMessages(id)));
            } catch (NumberFormatException e) {
                res.status(400);
                return gson.toJson(new Error("Session id must be a number."));
            } catch (Exception e) {
                return fail(res, "GET /api/chat/sessions/:id failed", e);
            }
        });

        post("/api/chat/sessions/:id/messages", (req, res) -> {
            res.type("application/json");
            try {
                long id = Long.parseLong(req.params(":id"));
                NewMessage body = gson.fromJson(req.body(), NewMessage.class);
                if (body == null || body.role == null || body.content == null || Database.get().getChatSession(id) == null) {
                    res.status(400);
                    return gson.toJson(new Error("Need an existing session, a role and content."));
                }
                long messageId = Database.get().addChatMessage(id, body.role.equals("assistant") ? "assistant" : "user", body.content, body.card);
                return gson.toJson(new Saved(id, messageId));
            } catch (NumberFormatException e) {
                res.status(400);
                return gson.toJson(new Error("Session id must be a number."));
            } catch (Exception e) {
                return fail(res, "POST /api/chat/sessions/:id/messages failed", e);
            }
        });

        // A card was used (added, changed or deleted): store its new state
        put("/api/chat/messages/:id/card", (req, res) -> {
            res.type("application/json");
            try {
                long id = Long.parseLong(req.params(":id"));
                NewMessage body = gson.fromJson(req.body(), NewMessage.class);
                if (body == null || body.card == null) {
                    res.status(400);
                    return gson.toJson(new Error("Need a card."));
                }
                if (!Database.get().setChatMessageCard(id, body.card)) {
                    res.status(404);
                    return gson.toJson(new Error("Message not found."));
                }
                return gson.toJson(new Created(id));
            } catch (NumberFormatException e) {
                res.status(400);
                return gson.toJson(new Error("Message id must be a number."));
            } catch (Exception e) {
                return fail(res, "PUT /api/chat/messages/:id/card failed", e);
            }
        });

        delete("/api/chat/sessions/:id", (req, res) -> {
            res.type("application/json");
            try {
                long id = Long.parseLong(req.params(":id"));
                if (!Database.get().deleteChatSession(id)) {
                    res.status(404);
                    return gson.toJson(new Error("Session not found."));
                }
                return gson.toJson(new Created(id));
            } catch (NumberFormatException e) {
                res.status(400);
                return gson.toJson(new Error("Session id must be a number."));
            } catch (Exception e) {
                return fail(res, "DELETE /api/chat/sessions/:id failed", e);
            }
        });
    }

    private String fail(spark.Response res, String what, Exception e) {
        LOGGER.log(Level.SEVERE, what, e);
        res.status(500);
        return gson.toJson(new Error("Failed: " + e.getMessage()));
    }

    static class NewMessage {
        String role, content, card;
    }

    static class Saved {
        long id, messageId;
        Saved(long id, long messageId) { this.id = id; this.messageId = messageId; }
    }

    static class Created {
        long id;
        Created(long id) { this.id = id; }
    }

    static class Error {
        String error;
        Error(String e) { this.error = e; }
    }

    static class SessionWithMessages {
        long id;
        String startedAt, title;
        List<Database.ChatMessageRow> messages;
        SessionWithMessages(Database.ChatSessionRow s, List<Database.ChatMessageRow> m) {
            this.id = s.id();
            this.startedAt = s.startedAt();
            this.title = s.title();
            this.messages = m;
        }
    }
}
