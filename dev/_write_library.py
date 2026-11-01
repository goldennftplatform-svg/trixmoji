import json, os

root = r"C:\Users\franc\Desktop\DOSWAPZ\assets\data\library"
os.makedirs(os.path.join(root, "artists"), exist_ok=True)

def track(title, sid, genre=""):
    return {
        "id": sid,
        "title": title,
        "genre": genre,
        "kind": "audio",
        "url": "https://cdn1.suno.ai/%s.mp3" % sid,
        "suno": "https://suno.com/song/%s" % sid,
        "cover": "https://cdn2.suno.ai/%s.jpeg" % sid
    }

jay = {
    "id": "jayfeezy",
    "name": "JayFeezy",
    "aka": ["jAI Feezy", "Jaifeezy", "jAIfeezy"],
    "site": "https://jaifeezy.netlify.app/",
    "suno": "https://suno.com/@jaifeezy",
    "soundcloud": "https://soundcloud.com/jay-feezy-271662322",
    "x": "https://x.com/jayfeezy",
    "youtube": "https://www.youtube.com/@j-ai-feezy",
    "bio": "Making music that sounds human because it starts that way. AI as a creative partner, not a shortcut.",
    "tracks": [
        track("Life Was Happening", "542d1fad-450a-4733-8fa8-07233f185eed", "R&B / Reflective / Cinematic"),
        track("I Still Talk To You", "86b70fef-8eb5-42dc-b18e-5e9765eb3c5d", "Piano Ballad / Cinematic"),
        track("Time (You Slow It Down For Me)", "3cbad066-511f-42b2-88b2-69ce90fdb661", "Acoustic / Indie Folk"),
        track("That Kinda Thing", "b1a0e2ca-924c-4307-8c25-fabd80ee6fb1", "Pop-R&B / Groove"),
        track("The Bottom", "37f290c0-cc12-4fcb-adfc-52bf14bde464", "Nu-Metal"),
        track("눈물 속 왕관", "debd885d-9fcb-4e76-ad03-104f9c93ccc7", "Cinematic K-Pop"),
        track("The Worst Birthday Ever", "bef2e876-ac39-480e-95ec-de16058e912f", "Alt Rock / Ballad"),
        track("Holy Hell [Sanctum Infernum]", "e5bffcd3-b9bb-4aeb-b305-926618a292ab", "EDM / Industrial"),
        track("Call It Truth (Acapella Remix)", "c172d539-549d-4dc6-b25d-900f6552178b", "Country Rock / Acapella"),
        track("I Was Working…", "a5ee8fa2-cb6f-4a50-8609-c4e51a490e46", "Indie Cinematic / Piano Ballad"),
        track("Time (Hyper Trap Remix)", "d4884c75-7c39-4922-9378-56911538eee3", "Hyper Trap / Remix"),
        track("Rings Remix [Part DEUCE]", "3f6b7f6f-9cf0-4606-95b1-5d538a522185", "Hip-Hop / Cinematic"),
        track("Call It Truth", "99793c49-3df4-43d1-ab0e-8eb627bdbb5f", "Country-Pop"),
        track("Oh No (Can't Stop Thinking of You)", "cb889127-ed8c-4156-8378-566fc6f354e5", "Lo-Fi / Alt-Pop"),
        track("Between Frequencies", "278e4ffa-0b8e-4534-8977-4b2366291442", "Alt-Pop / Ambient"),
        track("Ghost Inside My Bed", "479dece6-ae28-4249-b4f4-6dd1c7ac3980", "Acoustic Rock"),
        track("If Geoff Were One Of Us", "9b395b62-d558-4cf1-995b-057f1d146705", "Electro-Pop"),
        track("Still Here", "d8fdd65c-06c4-40fb-815c-c4ed8b38c25f", "Hyperpop / Trap / EDM"),
        track("The Weekend Breakdown", "4f1cf539-9632-4e43-bebb-b0592d7e34e0", "EDM / Hype"),
        track("The Tree Still Waits", "27e0706f-ee02-4bc2-80d0-7097abeaf152", "Country Christmas"),
        track("Right Where You Left My Heart", "2d1f83a3-6f3b-45d7-a3b8-ebdecb4430ee", "R&B / Soul"),
        track("Embedding Jam (Skin 2 Skin)", "6d8404a2-64f5-4880-b9c2-bf695c0621b9", "R&B / Collab"),
        track("Keys On Me", "2da2878e-7013-475c-bb9e-cc5d38b0edc4", "Hip-Hop / Keys"),
        track("God's Plan", "ab9d0757-44ab-4538-8aef-28f6dd6cdee7", "R&B / Hip-Hop / Fusion"),
        track("God's Plan (Victory Remix)", "85d09f1d-b285-4612-bfb4-87427d8bba5f", "Remix / Anthem"),
        track("God's Plan (Dark Remix)", "deeba362-5574-42e3-8c5e-24336375b67a", "Remix / Dark"),
        track("I Say I'm Done", "8be1e7b2-71c5-45ba-97fe-e10aa8334a0c", "R&B / Soul"),
        track("I Said I'm Done [House Remix]", "bf9a7857-f228-4778-b98a-9ad7d11b4205", "House / R&B"),
        track("If You Ain't Talkin About Geoff", "e4c185b3-867d-4851-81ca-00b8d0c3b005", "Hip-Hop"),
        track("If You Ain't Talkin Bout Geoff [House Remix]", "c0f98cfd-7952-4276-b050-b5a08c9059ff", "House / Hip-Hop"),
        track("Stand Up (Enters Rooms Remix)", "b0b6e252-f4e2-4c73-92df-6f122e2c1abd", "Hip-Hop / Remix"),
        track("Show You", "2cb77a26-a578-47c5-976d-e19a3c87a574", "R&B / Pop"),
        track("Brave Enough", "d1cf217e-fcda-4ac1-b6ec-cef128ba3502", "Pop / Uplifting"),
        track("Too Late Now", "b279275a-2236-45e4-949e-f3a0839fc228", "R&B / Late Night"),
        track("Red Lights", "ea8e9440-16cf-4820-aaa5-b132213f6b64", "R&B / Cinematic"),
        track("Why Why Why", "6acc17eb-7d44-4eec-a0da-6a2f8210fa98", "R&B"),
        track("How Is It (Tell Me)", "25f44a4b-eee7-40e6-93a9-0152a85d24f4", "R&B / Soul"),
        track("Why Do Things Happen", "db94c937-e682-45b3-80ae-14a0d6c77851", "Pop / Reflective"),
        track("Had You", "7d93afed-cec8-40cc-b2fd-e8f2f2ec8c94", "R&B / Nostalgic"),
        track("Kora Vain", "a33bacc8-bf66-46bb-a4c9-81e26865afe6", "Cinematic / Hip-Hop"),
        track("Vala Koré", "7a906ee6-b960-4f74-aaf7-c1611e015f1a", "Cinematic / Choral"),
        track("Unloved", "2c2f83c8-182a-49e1-888e-98358e5520d3", "R&B / Soul"),
        track("Sweet Little Problem", "b676c8eb-fbad-4981-a6ca-2db90cbb9830", "Pop / R&B"),
        track("Glass ft. ATMTA", "129a17fc-96ed-42bf-8020-de9386c5458a", "Cinematic / Electronic"),
        track("Perky", "1cc483b4-6aa3-40bb-a8d8-42504cb95928", "Pop / Upbeat"),
        track("Drugs Are Bad", "6d94a659-3ae5-4b69-9295-e651f44a8bd5", "Alt / Satirical"),
        track("I'ma Give Her That Salami", "8a1b4fc9-c095-4e12-bfc2-499f1b52001e", "Comedy / Hip-Hop"),
        track("You Knew", "2e14d165-ac96-4c16-9032-fd9a0438e260", "R&B / Soul")
    ]
}

slump = {
    "id": "slumpork",
    "name": "Slumpork",
    "aka": ["SLUM", "Slumpork"],
    "suno": "https://suno.com/song/db2dd24f-01cd-48ad-ae9a-17cae4a0cdfc",
    "bio": "Artist folder for Slumpork / SLUM.",
    "tracks": [
        track("Void This Blunt", "db2dd24f-01cd-48ad-ae9a-17cae4a0cdfc", "Hip-Hop")
    ]
}

index = {
    "title": "DOSWAPZ MEDIA LIBRARY",
    "artists": [
        {"id": "jayfeezy", "name": "JayFeezy", "file": "artists/jayfeezy.json", "tracks": len(jay["tracks"]), "site": jay["site"]},
        {"id": "slumpork", "name": "Slumpork", "file": "artists/slumpork.json", "tracks": len(slump["tracks"]), "suno": slump["suno"]}
    ]
}

open(os.path.join(root, "index.json"), "w", encoding="utf-8").write(json.dumps(index, indent=2))
open(os.path.join(root, "artists", "jayfeezy.json"), "w", encoding="utf-8").write(json.dumps(jay, indent=2))
open(os.path.join(root, "artists", "slumpork.json"), "w", encoding="utf-8").write(json.dumps(slump, indent=2))
print("jay", len(jay["tracks"]), "slump", len(slump["tracks"]))
