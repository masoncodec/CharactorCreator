import json
import os

# CONFIGURATION
MODULE_ID = "legendary-space-adventure"
BASE_PATH = os.path.join("data", "modules", MODULE_ID)

# Map your old "List Files" to the new "Folder Names" you want
MIGRATION_MAP = {
    "abilities.json": "abilities",
    "flaws.json": "flaws",
    "perks.json": "perks",
    "bestiary.json": "bestiary",
    "communities.json": "communities",
    "equipmentAndLoot.json": "items",
    "relationships.json": "relationships"
}

def migrate_data():
    """Splits large JSON lists OR objects into individual files."""
    print(f"--- Starting Migration for {MODULE_ID} ---")
    
    for source_file, folder_name in MIGRATION_MAP.items():
        source_path = os.path.join(BASE_PATH, source_file)
        target_dir = os.path.join(BASE_PATH, folder_name)
        
        if not os.path.exists(source_path):
            print(f"Skipping {source_file} (File not found)")
            continue
            
        # Create the new folder
        os.makedirs(target_dir, exist_ok=True)
        
        try:
            with open(source_path, 'r') as f:
                data = json.load(f)
            
            items_to_process = []

            # CASE A: The file is a Dictionary/Object (Like abilities.json)
            if isinstance(data, dict):
                print(f"Detected Dictionary format for {source_file}")
                for key, content in data.items():
                    # If the object inside doesn't have an ID, use the Key as the ID
                    if 'id' not in content:
                        content['id'] = key
                    items_to_process.append(content)

            # CASE B: The file is a List/Array
            elif isinstance(data, list):
                print(f"Detected List format for {source_file}")
                items_to_process = data

            else:
                print(f"Skipping {source_file} (Unknown format)")
                continue

            # Write the files
            count = 0
            for item in items_to_process:
                item_id = item.get('id')
                if not item_id:
                    print(f"Warning: An item in {source_file} has no ID. Skipping.")
                    continue
                
                file_name = f"{item_id}.json"
                with open(os.path.join(target_dir, file_name), 'w') as out:
                    json.dump(item, out, indent=4)
                count += 1
            
            print(f"Migrated {count} items from {source_file} into /{folder_name}/")
            
        except Exception as e:
            print(f"Error migrating {source_file}: {e}")

def generate_manifest():
    """Scans folders and creates a manifest.json."""
    print(f"\n--- Generating Manifest for {MODULE_ID} ---")
    
    # Folders we want to index (mapped folders + your existing folders)
    folders_to_scan = list(MIGRATION_MAP.values()) + ["destinies", "purposes", "nurtures"]
    # Remove duplicates just in case
    folders_to_scan = list(set(folders_to_scan))
    
    manifest = {}
    
    for folder in folders_to_scan:
        folder_path = os.path.join(BASE_PATH, folder)
        if not os.path.exists(folder_path):
            manifest[folder] = []
            continue
            
        # Get all .json files in the folder
        files = [f.replace('.json', '') for f in os.listdir(folder_path) if f.endswith('.json')]
        manifest[folder] = files
        print(f"Found {len(files)} items in {folder}")

    # Write the manifest file
    manifest_path = os.path.join(BASE_PATH, "manifest.json")
    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=4)
    
    print(f"Success! Manifest saved to {manifest_path}")

if __name__ == "__main__":
    # 1. Run Migration
    migrate_data()
    
    # 2. Generate the Index
    generate_manifest()