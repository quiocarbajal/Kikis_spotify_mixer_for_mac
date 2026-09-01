import os
import sys
import unittest

os.environ["DATABASE_PATH"] = os.path.abspath("test_spotify.db")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

import database as db
db.DB_PATH = os.path.abspath("test_spotify.db")
import spotify_client as sp_client
import applescript_controller as apple_ctrl
from fastapi.testclient import TestClient
from main import app

class TestSpotifySmartController(unittest.TestCase):
    
    @classmethod
    def setUpClass(cls):
        db.init_db()
        
    @classmethod
    def tearDownClass(cls):
        if os.path.exists("test_spotify.db"):
            os.remove("test_spotify.db")

    def test_01_tracks_management(self):
        # Seed test tracks
        sample_tracks = [
            {"id": "t1", "uri": "spotify:track:t1", "title": "Track One", "artist": "Artist A", "album": "Album 1", "duration_ms": 200000},
            {"id": "t2", "uri": "spotify:track:t2", "title": "Track Two", "artist": "Artist B", "album": "Album 2", "duration_ms": 210000},
            {"id": "t3", "uri": "spotify:track:t3", "title": "Track Three", "artist": "Artist A", "album": "Album 1", "duration_ms": 180000},
            {"id": "t4", "uri": "spotify:track:t4", "title": "Fourth Track", "artist": "Artist C", "album": "Album 3", "duration_ms": 190000},
        ]
        db.upsert_tracks(sample_tracks)
        
        all_tracks = db.get_tracks_query()
        track_ids = [t["id"] for t in all_tracks]
        self.assertIn("t1", track_ids)
        self.assertIn("t2", track_ids)
        self.assertIn("t3", track_ids)
        self.assertIn("t4", track_ids)

    def test_02_tracks_search_and_sorting(self):
        # Test title search
        search_res = db.get_tracks_query(search="Track One")
        self.assertEqual(len(search_res), 1)
        self.assertEqual(search_res[0]["id"], "t1")

        # Test artist search
        artist_res = db.get_tracks_query(search="Artist A")
        self.assertEqual(len(artist_res), 2)
        artist_ids = sorted([t["id"] for t in artist_res])
        self.assertEqual(artist_ids, ["t1", "t3"])

        # Test sorting
        sorted_tracks = db.get_tracks_query(sort_by="duration_ms", sort_direction="desc")
        self.assertEqual(sorted_tracks[0]["id"], "t2") # 210000ms is longest

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
        
        # Get Playlists
        res_pl = client.get("/api/playlists")
        self.assertEqual(res_pl.status_code, 200)
        
        # Get Tracks
        res_tracks = client.get("/api/tracks")
        self.assertEqual(res_tracks.status_code, 200)
        self.assertGreaterEqual(len(res_tracks.json()["tracks"]), 4)

    def test_06_discovery_genres_and_decades(self):
        client = TestClient(app)
        
        # Test search_genres
        popular_genres = sp_client.search_genres(category="Popular")
        popular_ids = [g["id"] for g in popular_genres]
        self.assertIn("pop", popular_ids)
        self.assertIn("rock", popular_ids)
        
        indie_search = sp_client.search_genres(query="indie")
        self.assertTrue(any("indie" in g["id"] for g in indie_search))
        
        # Test API endpoint
        res = client.get("/api/discovery/genres?category=Rock%20%26%20Indie")
        self.assertEqual(res.status_code, 200)
        api_genre_ids = [g["id"] for g in res.json()["genres"]]
        self.assertIn("indie-pop", api_genre_ids)
        
        res_decades = client.get("/api/discovery/decades")
        self.assertEqual(res_decades.status_code, 200)
        api_decade_ids = [d["id"] for d in res_decades.json()["decades"]]
        self.assertIn("90s", api_decade_ids)

    def test_07_playback_history_and_negative_exclusions(self):
        # Record playback
        db.record_playback("t1")
        recent_ids = db.get_recently_played_ids(days=7)
        self.assertIn("t1", recent_ids)
        
        # Test playlist and saved tracks queries
        saved_ids = db.get_all_user_saved_track_ids()
        self.assertIsInstance(saved_ids, (set, list))
        
        playlist_track_ids = db.get_all_playlist_track_ids()
        self.assertIsInstance(playlist_track_ids, (set, list))

    def test_08_live_and_remix_regex_filters(self):
        self.assertTrue(sp_client.is_live_track("Hotel California - Live at The Forum, 1976"))
        self.assertTrue(sp_client.is_live_track("Comfortably Numb (Live)"))
        self.assertTrue(sp_client.is_live_track("De Música Ligera - En Vivo"))
        self.assertFalse(sp_client.is_live_track("Hotel California - 2013 Remaster"))
        
        self.assertTrue(sp_client.is_remix_track("Around The World - Kenlou Remix"))
        self.assertTrue(sp_client.is_remix_track("Midnight City (Eric Prydz Club Mix)"))
        self.assertTrue(sp_client.is_remix_track("Levitating feat. DaBaby - Don Diablo VIP Edit"))
        self.assertFalse(sp_client.is_remix_track("Around The World"))

    def test_09_discovery_api_endpoints(self):
        client = TestClient(app)
        
        # Test suggest endpoint for genres
        res_suggest = client.get("/api/discovery/suggest?type=genre&q=pop")
        self.assertEqual(res_suggest.status_code, 200)
        suggestions = res_suggest.json()["suggestions"]
        self.assertTrue(any(s["id"] == "pop" or "pop" in s["name"].lower() for s in suggestions))
        
        # Test active-vibe endpoint
        res_vibe = client.get("/api/discovery/active-vibe?playlist_id=playlist_test")
        self.assertEqual(res_vibe.status_code, 200)
        vibe_data = res_vibe.json()["vibe"]
        self.assertIn("top_artists", vibe_data)
        
        # Test discovery generate endpoint (with local DB fallback)
        payload = {
            "artists": [{"value": "Artist A", "modifier": "AND"}],
            "genres": [{"value": "rock", "modifier": "AND"}],
            "decades": [{"value": "90s", "modifier": "AND"}],
            "tracks": [],
            "keywords": [],
            "use_active_vibe": False,
            "not_liked_songs": False,
            "not_in_playlists": False,
            "not_recently_played_days": None,
            "not_live": True,
            "not_remix": True,
            "target_count": 30,
            "true_shuffle": True,
            "avoid_consecutive_artists": True
        }
        res_gen = client.post("/api/discovery/generate", json=payload)
        self.assertEqual(res_gen.status_code, 200)
        gen_data = res_gen.json()
        self.assertIn("tracks", gen_data)
        self.assertIn("total_discovered", gen_data)

    def test_10_boolean_matrix_filtering_logic(self):
        # Test candidate evaluation logic with mock tracks
        raw_candidates = [
            {"id": "cand1", "title": "Track Normal", "artist": "Excluded Artist", "album": "Album A", "duration_ms": 180000},
            {"id": "cand2", "title": "Live in Paris", "artist": "Great Band", "album": "Concert", "duration_ms": 200000},
            {"id": "cand3", "title": "Song (David Guetta Remix)", "artist": "Singer", "album": "Hits", "duration_ms": 210000},
            {"id": "cand4", "title": "Genuinely Fresh Song", "artist": "New Artist", "album": "New Album", "duration_ms": 195000},
        ]
        
        # Test 1: Exclude "Excluded Artist" via NOT artist
        not_artist_terms = [{"value": "Excluded Artist", "modifier": "NOT"}]
        filtered = [
            t for t in raw_candidates 
            if not any(term["value"].lower() in t["artist"].lower() for term in not_artist_terms)
        ]
        self.assertNotIn("cand1", [t["id"] for t in filtered])
        self.assertIn("cand4", [t["id"] for t in filtered])
        
        # Test 2: NOT Live and NOT Remix filters
        non_live = [t for t in raw_candidates if not sp_client.is_live_track(t["title"], t["album"])]
        self.assertNotIn("cand2", [t["id"] for t in non_live])
        
        non_remix = [t for t in raw_candidates if not sp_client.is_remix_track(t["title"], t["album"])]
        self.assertNotIn("cand3", [t["id"] for t in non_remix])
        
        # Combined strict filters should leave ONLY cand4 (when excluding cand1 artist)
        clean = [
            t for t in raw_candidates
            if not sp_client.is_live_track(t["title"], t["album"])
            and not sp_client.is_remix_track(t["title"], t["album"])
            and not any(term["value"].lower() in t["artist"].lower() for term in not_artist_terms)
        ]
        self.assertEqual([t["id"] for t in clean], ["cand4"])

    def test_11_canonical_track_identity_deduplication(self):
        # Verify same song across different albums, remasters, and parentheticals map to identical canonical key
        k_original = sp_client.get_track_identity_key("Azul", "Cristian Castro")
        k_remaster = sp_client.get_track_identity_key("Azul - 2004 Remaster", "Cristian Castro")
        k_greatest_hits = sp_client.get_track_identity_key("Azul (Grandes Éxitos)", "Cristian Castro")
        k_live = sp_client.get_track_identity_key("Azul (Live)", "Cristian Castro")
        
        self.assertEqual(k_original, k_remaster)
        self.assertEqual(k_original, k_greatest_hits)
        self.assertEqual(k_original, k_live)
        self.assertEqual(k_original, ("azul", "cristiancastro"))

    def test_12_typeahead_suggestions(self):
        # Test suggest_artists and suggest_tracks endpoints
        client = TestClient(app)
        res_t = client.get("/api/discovery/suggest?type=track&q=Track")
        self.assertEqual(res_t.status_code, 200)
        data_t = res_t.json()
        self.assertIn("suggestions", data_t)

        res_a = client.get("/api/discovery/suggest?type=artist&q=Artist")
        self.assertEqual(res_a.status_code, 200)
        data_a = res_a.json()
        self.assertIn("suggestions", data_a)

    def test_13_low_popularity_filter(self):
        # Test low popularity filtering logic
        tracks = [
            {"id": "pop1", "title": "Mega Hit", "artist": "Superstar", "popularity": 85},
            {"id": "pop2", "title": "Medium Hit", "artist": "Indie Band", "popularity": 55},
            {"id": "pop3", "title": "Underground Gem", "artist": "Niche Singer", "popularity": 22},
        ]
        low_pop_tracks = [t for t in tracks if t.get("popularity", 0) <= 42]
        self.assertEqual(len(low_pop_tracks), 1)
        self.assertEqual(low_pop_tracks[0]["id"], "pop3")

    def test_14_playlist_creation_and_overwrite(self):
        client = TestClient(app)
        # 1. Create initial playlist
        res1 = client.post("/api/playlists/create", json={
            "name": "Test Party Mix",
            "description": "Initial mix",
            "track_ids": ["t1", "t2"]
        })
        self.assertEqual(res1.status_code, 200)
        p_id = res1.json()["playlist_id"]

        # 2. Overwrite the playlist with confirmation flag
        res2 = client.post("/api/playlists/create", json={
            "name": "Test Party Mix",
            "description": "Updated mix",
            "track_ids": ["t3", "t4", "t5"],
            "overwrite": True,
            "playlist_id": p_id
        })
        self.assertEqual(res2.status_code, 200)
        data2 = res2.json()
        self.assertTrue(data2.get("overwritten"))
    def test_15_default_target_count_and_empty_workspace(self):
        client = TestClient(app)
        # Test DiscoveryMatrixRequest default target count
        res = client.post("/api/discovery/generate", json={
            "artists": [],
            "tracks": [],
            "genres": [{"value": "pop", "modifier": "AND"}]
        })
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data.get("target_count"), 30)

if __name__ == "__main__":
    unittest.main()



