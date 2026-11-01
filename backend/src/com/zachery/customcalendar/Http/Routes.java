package com.zachery.customcalendar.Http;

import java.util.logging.Level;
import java.util.logging.Logger;

import spark.Request;
import spark.Response;
import spark.Route;

public final class Routes {

    private Routes() {}

    // printStackTrace() goes to stderr, and release builds pipe the backend's stderr to null,
    // so failures are logged here instead
    private static final Logger LOGGER = Logger.getLogger(Routes.class.getName());

    @FunctionalInterface
    public interface Handler {
        Object handle(Request req, Response res) throws Exception;
    }

    /** The caller sent something wrong; answered with HTTP 400 and the message. */
    public static class BadRequest extends RuntimeException {
        public BadRequest(String message) {
            super(message);
        }
    }

    /**
     * Wraps a handler so every route answers the same way: whatever the handler returns is
     * serialised as JSON, and any exception becomes a logged HTTP 500 message.
     */
    public static Route json(String name, Handler handler) {
        return (req, res) -> {
            res.type("application/json");
            try {
                return Json.GSON.toJson(handler.handle(req, res));
            } catch (BadRequest e) {
                res.status(400);
                return Json.GSON.toJson(new Json.Message(e.getMessage()));
            } catch (@SuppressWarnings("TooBroadCatch") Exception e) {
                LOGGER.log(Level.SEVERE, name + " failed", e);
                res.status(500);
                return Json.GSON.toJson(new Json.Message("Failed: " + e.getMessage()));
            }
        };
    }
}
