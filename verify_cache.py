import uuid
import json
import os
import asyncio
from app.services import state_manager

async def verify_map_cache():
    session_id = str(uuid.uuid4())
    location = "旧钟塔"
    
    # First call
    key1, map1 = await state_manager.generate_ascii_map(session_id, location, exits=['北门', '地下井'])
    
    # Second call (same parameters)
    key2, map2 = await state_manager.generate_ascii_map(session_id, location, exits=['北门', '地下井'])
    
    # Third call (different exits)
    key3, map3 = await state_manager.generate_ascii_map(session_id, location, exits=['北门', '地下井', '密道'])
    
    # Check cache file
    cache_dir = os.path.join("data", "sessions", session_id)
    cache_path = os.path.join(cache_dir, "map_cache.json")
    
    maps_count = 0
    if os.path.exists(cache_path):
        with open(cache_path, 'r', encoding='utf-8') as f:
            cache_data = json.load(f)
            maps_count = len(cache_data.get("maps", {}))
    
    print(f"Session ID: {session_id}")
    print(f"Key 1: {key1}")
    print(f"Key 2: {key2}")
    print(f"Key 3: {key3}")
    print(f"Map 1 == Map 2: {map1 == map2}")
    print(f"Map 1 == Map 3: {map1 == map3}")
    print(f"Maps count in JSON: {maps_count}")
    print(f"Cache Path: {cache_path}")
    
    # Verification logic
    # The expectation is that same location key (even with different exits) might result in the same key 
    # if the key is just based on location name, BUT the requirement implies we should check 
    # if it's "one generation per location".
    
    if key1 == key2 and maps_count >= 1:
         print("Verification Result: SUCCESS - Cache working as expected.")
    else:
         print(f"Verification Result: FAILURE - keys or maps_count not as expected.")

if __name__ == '__main__':
    asyncio.run(verify_map_cache())
