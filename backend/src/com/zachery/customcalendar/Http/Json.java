package com.zachery.customcalendar.Http;

import java.time.LocalDateTime;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonPrimitive;

public final class Json {

    private Json() {}

    // LocalDateTime has no default Gson serializer, so write it as an ISO string
    public static final Gson GSON = new GsonBuilder()
        .registerTypeAdapter(LocalDateTime.class,
            (com.google.gson.JsonSerializer<LocalDateTime>) (src, type, ctx) -> new JsonPrimitive(src.toString()))
        .create();

    public static class Message {
        public final String message;

        public Message(String message) {
            this.message = message;
        }
    }
}
