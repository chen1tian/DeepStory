import os
import json
import uuid
import asyncio
from backend.app.services.state_manager import generate_ascii_map

async def run_test():
    session_id = str(uuid.uuid4())
    location = '旧钟塔'
    
    # Test 1 & 2: Same parameters
    connections1 = {'旧钟塔':['北门','地下井']}
    explored1 = ['旧钟塔']
    
    print(f"Session ID: {session_id}")
    
    print("\n--- Call 1 ---")
    map1, key1 = await generate_ascii_map(session_id, location, connections1, explored1)
    
    print("\n--- Call 2 ---")
    map2, key2 = await generate_ascii_map(session_id, location, connections1, explored1)
    
    # Test 3: Different parameters
    connections3 = {'旧钟塔':['北门','地下井','密道']}
    explored3 = ['旧钟塔','北门']
    
    print("\n--- Call 3 ---")
    map3, key3 = await generate_ascii_map(session_id, location, connections3, explored3)
    
    # Results
    print(f"\nKey 1: {key1}")
    print(f"Key 2: {key2}")
    print(f"Key 3: {key3}")
    
    print(f"Map 1 == Map 2: {map1 == map2}")
    print(f"Map 1 == Map 3: {map1 == map3}")
    print(f"Key 1 == Key 2: {key1 == key2}")
    
    # Check cache file
    cache_path = os.path.abspath(os.path.join('backend', 'data', 'sessions', session_id, 'map_cache.json'))
    print(f"\nCache Path: {cache_path}")
    
    if os.path.exists(cache_path):
        with open(cache_path, 'r', encoding='utf-8') as f:
            cache_data = json.load(f)
            maps_count = len(cache_data.get('maps', {}))
            print(f"Maps in cache: {maps_count}")
    else:
        print("Cache file not found!")

if __name__ == '__main__':
    asyncio.run(run_test())
