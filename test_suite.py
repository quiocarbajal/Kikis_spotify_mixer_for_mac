import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

import database as db
import spotify_client as sp_client
import applescript_controller as apple_ctrl
from fastapi.testclient import TestClient
from main import app

class TestSpotifySmartController(unittest.TestCase):
    
    @classmethod
    def setUpClass(cls):
        os.environ["DATABASE_PATH"] = "test_spotify.db"
        db.init_db()
        
    @classmethod
    def tearDownClass(cls):
        if os.path.exists("test_spotify.db"):
            os.remove("test_spotify.db")

    def test_01_tags_management(self):
        # Create custom tags
        db.create_or_update_tag("Gym", "#ef4444")
        db.create_or_update_tag("Coding", "#3b82f6")
        
        tags = db.get_all_tags()
        tag_names = [t["name"] for t in tags]
        self.assertIn("Gym", tag_names)
        self.assertIn("Coding", tag_names)

    def test_02_tracks_and_bulk_tagging(self):
        # Seed test tracks
        sample_tracks = [
            {"id": "t1", "uri": "spotify:track:t1", "title": "Track One", "artist": "Artist A", "album": "Album 1", "duration_ms": 200000},
            {"id": "t2", "uri": "spotify:track:t2", "title": "Track Two", "artist": "Artist B", "album": "Album 2", "duration_ms": 210000},
            {"id": "t3", "uri": "spotify:track:t3", "title": "Track Three", "artist": "Artist A", "album": "Album 1", "duration_ms": 180000},
            {"id": "t4", "uri": "spotify:track:t4", "title": "Untagged Track", "artist": "Artist C", "album": "Album 3", "duration_ms": 190000},
        ]
        db.upsert_tracks(sample_tracks)
        
        # Bulk tag t1 and t2 with 'Gym'
        db.assign_tags_to_tracks(["t1", "t2"], ["Gym"])
        # Tag t1 and t3 with 'Coding'
        db.assign_tags_to_tracks(["t1", "t3"], ["Coding"])
        
        # Test Boolean Filter AND: 'Gym' AND 'Coding' (should be ONLY t1)
        and_tracks = db.get_tracks_query(tags=["Gym", "Coding"], filter_mode="AND")
        and_ids = [t["id"] for t in and_tracks]
        self.assertEqual(and_ids, ["t1"])
        
        # Test Boolean Filter OR: 'Gym' OR 'Coding' (should be t1, t2, t3)
        or_tracks = db.get_tracks_query(tags=["Gym", "Coding"], filter_mode="OR")
        or_ids = sorted([t["id"] for t in or_tracks])
        self.assertEqual(or_ids, ["t1", "t2", "t3"])
        
        # Test Untagged filter (should be t4)
        untagged = db.get_tracks_query(untagged_only=True)
        untagged_ids = [t["id"] for t in untagged]
        self.assertIn("t4", untagged_ids)

    def test_03_custom_user_order(self):
        # Set initial custom playlist order
        db.set_playlist_tracks("playlist_test", ["t3", "t1", "t2"])
        
        tracks = db.get_tracks_query(playlist_id="playlist_test", sort_by="order_index", sort_direction="asc")
        ordered_ids = [t["id"] for t in tracks]
        self.assertEqual(ordered_ids, ["t3", "t1", "t2"])
        
        # Reorder to ['t2', 't3', 't1']
        db.reorder_playlist_tracks("playlist_test", ["t2", "t3", "t1"])
        reordered_tracks = db.get_tracks_query(playlist_id="playlist_test", sort_by="order_index", sort_direction="asc")
        reordered_ids = [t["id"] for t in reordered_tracks]
        self.assertEqual(reordered_ids, ["t2", "t3", "t1"])

    def test_04_fisher_yates_true_shuffle(self):
        items = [f"spotify:track:{i}" for i in range(100)]
        shuffled = sp_client.fisher_yates_true_shuffle(items)
        
        self.assertEqual(len(shuffled), 100)
        self.assertEqual(set(shuffled), set(items)) # All elements preserved
        self.assertNotEqual(shuffled, items) # True permutation

    def test_05_fastapi_endpoints(self):
        client = TestClient(app)
        
        # Status
        res = client.get("/api/status")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("authenticated", data)
        self.assertIn("local_ip", data)
        
        # Get Tags
        res_tags = client.get("/api/tags")
        self.assertEqual(res_tags.status_code, 200)
        
        # Get Tracks
        res_tracks = client.get("/api/tracks")
        self.assertEqual(res_tracks.status_code, 200)
        self.assertGreaterEqual(len(res_tracks.json()["tracks"]), 4)

if __name__ == "__main__":
    unittest.main()
