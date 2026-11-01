package com.zachery.customcalendar.Media;

import com.zachery.customcalendar.Storage.Database;
import com.zachery.customcalendar.Storage.SystemDirectory;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

/*
Background list lives in SQLite now (backgrounds table). Uploaded images stay on disk under
Calisigh/Backgrounds/Uploads; the table keeps each file's path relative to the Calisigh folder.
The API still hands out "name|&absolute path" strings with forward slashes.
*/
public class Backgrounds {
    private final Database db;

    public Backgrounds() throws SQLException {
        this.db = Database.get();
    }

    public void addBackground(String sourcePath) throws IOException, SQLException {
        File sourceFile = new File(sourcePath);
        if (!sourceFile.exists())
            throw new IOException("Source file does not exist: " + sourcePath);

        String fileName = sourceFile.getName();
        String displayName = fileName.contains(".")
                ? fileName.substring(0, fileName.lastIndexOf('.'))
                : fileName;

        // Skip if already exists
        if (db.findMedia(Database.BACKGROUNDS, displayName) != null) return;

        File destFile = SystemDirectory.Directory("Backgrounds/Uploads/" + fileName);
        destFile.getParentFile().mkdirs();
        Files.copy(sourceFile.toPath(), destFile.toPath(), StandardCopyOption.REPLACE_EXISTING);

        db.addMedia(Database.BACKGROUNDS, displayName, Database.toStoredPath(destFile));
    }

    public void removeBackground(String name) throws SQLException {
        Database.MediaRow row = db.findMedia(Database.BACKGROUNDS, name);
        if (row == null) {
            System.out.println("Background not found: " + name);
            return;
        }

        File uploadedFile = Database.fromStoredPath(row.path());
        if (uploadedFile.exists()) uploadedFile.delete();

        db.removeMedia(Database.BACKGROUNDS, name);
    }

    public List<String> getAllBackgrounds() throws SQLException {
        List<String> out = new ArrayList<>();
        for (Database.MediaRow r : db.listMedia(Database.BACKGROUNDS))
            out.add(r.name() + "|&" + Database.fromStoredPath(r.path()).getAbsolutePath().replace("\\", "/"));
        return out;
    }

    public static String getDisplayName(String entry) {
        return entry.split("\\|&", 2)[0];
    }

    public static String getFilePath(String entry) {
        String[] parts = entry.split("\\|&", 2);
        return parts.length == 2 ? parts[1] : "";
    }
}
