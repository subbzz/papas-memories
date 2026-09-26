import json, os, re
HERE = os.path.dirname(os.path.abspath(__file__))

CATS = [
  ("tapes",    "🎙️", "Little Voice Tapes",           "Tiny voice, big personality. Press play and time-travel.", "#ff8fab"),
  ("mama",     "👩‍👧", "Mama's Memory Tapes",          "One long treasured recording, snipped into bite-size tapes. Grab a cuppa and listen.", "#ffc8dd"),
  ("mamawedding", "💍", "Mama's Wedding Day", "Dada and Mama's big day on three old discs: family, rituals, the feast and the reception.", "#ffd6a5"),
  ("mamaceremony", "🌺", "Mama's Coming-of-Age Ceremony", "Silk, jasmine, blessings and a big family feast, from two old VHS tapes.", "#caffbf"),
  ("keepsakes", "🖼️", "Keepsakes & Photos", "Her own handwriting, and photos worth framing.", "#a0c4ff"),
  ("art", "🖌️", "Her Drawing Board", "Drawings she makes on the iPad: characters, dragons and sketchbook pages.", "#bdb2ff"),
  ("birthday", "🎂", "Cake, Candles & Party Hats",   "Wishes, presents, games and a lot of cake.",             "#ffb347"),
  ("easter",   "🐣", "Egg Hunts & Easter Shows",     "Chocolate eggs, face paint and carousel rides.",         "#b5e48c"),
  ("zoo",      "🦁", "Zoo Days & Big Adventures",    "Climbing, swinging, sliding, riding. Go, go, go!",       "#8ecae6"),
  ("school",   "🎒", "Playgroup, Playschool & Dance","New friends, balancing bridges and dance-class stars.",  "#cdb4db"),
  ("songs",    "🎵", "Songs, Rhymes & Storytime",    "Sing-alongs, rhymes, Kural and favourite books.",        "#ffd166"),
  ("home",     "🏠", "Giggles at Home",              "The everyday moments that turned out to be the best ones.", "#f4a261"),
  ("phone",    "📱", "Old Phone Treasures",          "Straight off the 2011 mobile phone: grainy, precious, perfect.", "#90e0ef"),
]

MON = {"Jan":1,"Feb":2,"Mar":3,"Apr":4,"May":5,"Jun":6,"Jul":7,"Aug":8,"Sep":9,"Oct":10,"Nov":11,"Dec":12}
MNAME = {v:k for k,v in MON.items()}
def dstr(d,m,y): return f"{int(d)} {['','January','February','March','April','May','June','July','August','September','October','November','December'][int(m)]} {y}"

# file -> (cat, emoji, title, caption, date)
V = {
 "I Love You Song": ("songs","💗","The I Love You Song","A song with the best lyrics ever written. Warning: may cause happy tears.",None),
 "Blah Blah Blah Time": ("home","🗣️","Blah Blah Blah Time","Chatterbox mode: ON. Somebody had a LOT to say!",None),
 "@SnowPlanet#WBnYD_zT9U4": ("zoo","❄️","Snow Planet (Part 1)","Brrr! A trip to Snow Planet. Snow, cold cheeks and big smiles.",None),
 "@SnowPlanet#RZY8J3cV6RM": ("zoo","⛄","Snow Planet (Part 2)","More snowy fun at Snow Planet. Round two!",None),
 "Facepainting at Whitcoulls Easter Fun...": ("easter","🎨","Face Painting at Whitcoulls Easter Fun","Sit still… almost… the Easter face-painting masterpiece.",None),
 "At Playgroup 2": ("school","🧸","At Playgroup (Part 2)","Another busy morning at playgroup.",None),
 "Caught Milo-Handed": ("home","🥤","Caught Milo-Handed!","Busted! The great Milo mystery, solved on camera.",None),
 "Dance Class Last Day of the Term Certificate": ("school","🏅","Dance Class: Certificate Time","Last day of term, and a certificate for our little dancer!",None),
 "Incy Wincy Spider Song": ("songs","🕷️","Incy Wincy Spider","Up the water spout… with all the actions!",None),
 "That's WRONG Dada": ("home","🙅‍♀️","That's WRONG, Dada!","Dada got it wrong, and he was told so. Very clearly.",None),
 "First Birthday Party": ("birthday","1️⃣","First Birthday Party","ONE! The very first birthday party.",None),
 "Reading ＂Just Like My Dad＂ (her next favorite) book with Mama": ("songs","📖","Reading “Just Like My Dad” with Mama","Storytime with Mama and her next-favourite book, “Just Like My Dad”.",None),
 "3rd Birthday Party - Pinata": ("birthday","🪅","3rd Birthday: The Piñata","Whack! Whack! 3rd birthday piñata action.",None),
 "Chat @ Home": ("home","☕","A Chat at Home","Settle in for a little chat at home.",None),
 "Adam with Kalla Alugai": ("home","😭","Adam and the Kalla Alugai","Adam, plus a performance of kalla alugai (the famous pretend cry). Award-worthy.",None),
 "Swinging @ Western Springs Playground": ("zoo","🌳","Swinging at Western Springs","Higher! Higher! Swinging at Western Springs Playground.",None),
 "30012011045": ("phone","📼","Phone Video · 30 Jan 2011","A little treasure straight off the phone.",(30,1,2011)),
 "At Zoo": ("zoo","🦒","A Day at the Zoo","Hello, animals! A day out at the zoo.",None),
 "Birthday Morning 1": ("birthday","🌅","Birthday Morning (Part 1)","Wakey wakey, birthday girl! The birthday morning begins.",None),
 "Easter Egg Painting at Mall": ("easter","🥚","Easter Egg Painting at the Mall","Brush in hand, egg in the other: Easter egg painting at the mall.",None),
 "I Love Barney!!!": ("songs","🦖","I Love Barney!!!","Three exclamation marks' worth of Barney love.",None),
 "25042011252": ("phone","📼","Phone Video · 25 Apr 2011","A little treasure straight off the phone.",(25,4,2011)),
 "Rock Climbing At Zoo": ("zoo","🧗‍♀️","Rock Climbing at the Zoo","Tiny climber, big wall. Rock climbing at the zoo!",None),
 "Bike Riding - Day 2": ("zoo","🚲","Bike Riding: Day 2","Day two on the bike, and getting the hang of it!",None),
 "Sleeptime at Nite": ("home","🌙","Sleeptime at Nite","Shhh… it's sleeptime. (Or is it?)",None),
 "19022011209": ("phone","📼","Phone Video · 19 Feb 2011 (b)","A little treasure straight off the phone.",(19,2,2011)),
 "Easter 2012 Yumm Yumm": ("easter","🍫","Easter 2012: Yumm Yumm","Chocolate verdict: yumm yumm.",(None,None,2012)),
 "Rope Walking At Zoo": ("zoo","🪢","Rope Walking at the Zoo","Steady… steady… rope walking at the zoo.",None),
 "Balancing Bridge @ Playschool": ("school","🌉","Balancing Bridge at Playschool","Arms out, eyes forward: the playschool balancing bridge.",None),
 "Angry Birds": ("home","🐦","Angry Birds","Angry Birds time! 🐷",None),
 "24042011251": ("phone","📼","Phone Video · 24 Apr 2011","A little treasure straight off the phone.",(24,4,2011)),
 "3rd Birthday Party - Game 2": ("birthday","🎲","3rd Birthday: Party Game 2","Party game number two. Let the games continue!",None),
 "Reading ＂Just Like My Mum＂ (her favorite) book on her own": ("songs","📚","Reading “Just Like My Mum” All By Herself","Her favourite book, “Just Like My Mum”, read ALL by herself!",None),
 "Kural": ("songs","📜","Kural Time","Kural time. Listen closely!",None),
 "Birthday Morning 2": ("birthday","🎁","Birthday Morning (Part 2)","The birthday morning continues…",None),
 "Mountain Climbing": ("zoo","⛰️","Mountain Climbing","Onwards and upwards: the great mountain climb!",None),
 "Royal Easter Show 2012. Carousal.": ("easter","🎠","Royal Easter Show 2012: Carousel","Round and round on the carousel at the 2012 Royal Easter Show.",(None,None,2012)),
 "3rd Birthday Present 2": ("birthday","🎀","3rd Birthday: Present #2","Rip! Present number two.",None),
 "Dance Class Last Day of the Term": ("school","💃","Dance Class: Last Day of Term","Showtime! Dance moves from the last day of term.",None),
 "3rd Birthday Party - PinTheTail": ("birthday","🫏","3rd Birthday: Pin the Tail","Blindfold on… where does that tail go?!",None),
 "Carousel @ Devonport Ferry Terminal": ("zoo","🎡","Carousel at Devonport Ferry Terminal","A spin on the carousel at Devonport Ferry Terminal.",None),
 "Riding Scooter on 9th Apr": ("zoo","🛴","Scooter Ride (9 April)","Whoosh! Scooter riding on the 9th of April.",None),
 "Polkadot Girl": ("home","🔴","Polkadot Girl","Dots, dots, everywhere dots. Meet Polkadot Girl!",None),
 "Riding New Bike on 9th Apr": ("zoo","🚴‍♀️","The New Bike (9 April)","Shiny new bike, first rides, 9th of April.",None),
 "Reading ＂Just Like My Mum＂ (her favorite) book with Mama": ("songs","📕","Reading “Just Like My Mum” with Mama","Her all-time favourite, “Just Like My Mum”, read together with Mama.",None),
 "Climbing @ Western Springs Playground": ("zoo","🧗","Climbing at Western Springs","Up, up, up at Western Springs Playground.",None),
 "@ School with Jeeta Teacher": ("school","👩‍🏫","At School with Jeeta Teacher","School time with Jeeta Teacher.",None),
 "Diego Diego Diego ADAM": ("home","🐆","Diego, Diego, Diego… ADAM!","Diego, Diego, Diego… ADAM! (You had to be there. Now you can be.)",None),
 "19022011208": ("phone","📼","Phone Video · 19 Feb 2011 (a)","A little treasure straight off the phone.",(19,2,2011)),
 "Royal Easter Show 2012. Bouncy Slide.": ("easter","🛝","Royal Easter Show 2012: Bouncy Slide","Weeee! The bouncy slide at the 2012 Royal Easter Show.",(None,None,2012)),
 "Bouncy Slide": ("zoo","🎈","Bouncy Slide","Bounce, slide, repeat!",None),
 "Playgroup 3": ("school","🖍️","Playgroup (Part 3)","Playgroup, episode three.",None),
 "Easter 2012 Happy Easter": ("easter","🐰","Easter 2012: Happy Easter!","A very important Easter message. Happy Easter!",(None,None,2012)),
 "3rd Birthday Present 1": ("birthday","🎁","3rd Birthday: Present #1","What's inside? Present number one!",None),
 "ABC Song": ("songs","🔤","The ABC Song","A-B-C-D… now we know our ABCs!",None),
 "3rd Birthday Party - Cake": ("birthday","🍰","3rd Birthday: The Cake","Candles lit, song sung. It's cake time!",None),
 "Mama, I am Flamingo": ("home","🦩","Mama, I Am a Flamingo","“Mama, I am flamingo!” One leg, maximum elegance.",None),
 "VIDEO0041": ("phone","📼","Phone Video #0041","A little treasure straight off the phone.",None),
 "3rd Birthday Party - Game 1": ("birthday","🎉","3rd Birthday: Party Game 1","Let the party games begin!",None),
 "Washing Hands @ Playschool with new friend": ("school","🧼","Washing Hands with a New Friend","Scrub-a-dub at playschool, with a brand-new friend.",None),
 "Love You KILI": ("home","🦜","Love You KILI","Love you, KILI! 💚",None),
 "Birthday @School": ("birthday","🏫","Birthday at School","Celebrating the birthday with the school crew.",None),
 "Second Birthday Party": ("birthday","2️⃣","Second Birthday Party","TWO! The second birthday party.",None),
 "Rhymes": ("songs","🎶","Rhymes","A rhyme-time medley.",None),
 "Computer Work At Zoo": ("zoo","💻","Computer Work at the Zoo","Very important computer work… at the zoo.",None),
 "Playgroup 1": ("school","🧩","Playgroup (Part 1)","Playgroup, episode one.",None),
 "Easter 2012 Egg Hunt Surprise": ("easter","🤩","Easter 2012: Egg Hunt Surprise","An egg hunt… with a surprise!",(None,None,2012)),
 "Animals": ("songs","🐘","Animals","Roar! Moo! Quack! All about the animals.",None),
 "Helping with Rubbish Disposal 2": ("home","🗑️","Little Helper: Rubbish Duty (Part 2)","Chief rubbish-disposal helper, reporting for duty (again).",None),
 "Sahana in Durra!!": ("home","✨","Sahana in Durra!!","Sahana in Durra!! (Two exclamation marks. It was that good.)",None),
 "@Home": ("home","🏡","At Home","Just a regular day at home, and that's what makes it special.",None),
 "Keyboard Player": ("songs","🎹","The Keyboard Player","Ladies and gentlemen… on the keyboard…",None),
 "Chat About Easter Show": ("easter","🎪","Chatting About the Easter Show","The full debrief on the Easter Show, straight from the source.",None),
 "VIDEO0040": ("phone","📼","Phone Video #0040","A little treasure straight off the phone.",None),
 "Playgroup 2": ("school","🪀","Playgroup (Part 2)","Playgroup, episode two.",None),
 "Easter 2012  Egg Hunt": ("easter","🧺","Easter 2012: The Egg Hunt","Basket ready… the 2012 Easter egg hunt is ON!",(None,None,2012)),
 "15 Feb11 01": ("phone","📼","Phone Video · 15 Feb 2011","A little treasure straight off the phone.",(15,2,2011)),
 "Mama's new Dishwasher": ("home","🍽️","Mama's New Dishwasher","Big news in the kitchen: Mama's new dishwasher!",None),
 "Anthakshari": ("songs","🎤","Anthakshari","Antakshari! The song-chain game, family edition.",None),
 "Birthday Morning 3": ("birthday","🥳","Birthday Morning (Part 3)","Birthday morning, the grand finale.",None),
}

A = {
 "DeDeAmma": ("🍼","De De Amma","“De De Amma!” A little voice, loud and clear.",None),
 "Mango": ("🥭","Mango!","Mango! The fruit, the word, the legend.",None),
 "Onion": ("🧅","Onion","Onion. Say it with feeling!",None),
 "HBD": ("🎂","Happy Birthday!","Happy birthday! 🎈 Press play for the birthday wishes.",None),
 "ThathaAachi": ("👴👵","Thatha & Aachi","Thatha and Aachi, in one little voice clip. 💛",None),
 "karan": ("👦","Karan","Karan! A tiny voice clip, big smiles.",None),
 "Correct": ("✅","Correct!","Correct! (No arguments accepted.)",None),
 "Mani_Viji": ("💌","Mani & Viji","Mani and Viji, in one little voice clip.",None),
 "Meena_Mohan": ("💌","Meena & Mohan","Meena and Mohan, in one little voice clip.",None),
 "21Feb1101": ("📅","Voice Tape · 21 Feb 2011","Recorded 21 February 2011.",(21,2,2011)),
 "25Feb1101": ("📅","Voice Tape · 25 Feb 2011","Recorded 25 February 2011.",(25,2,2011)),
 "28Feb1101": ("📅","Voice Tape · 28 Feb 2011","Recorded 28 February 2011.",(28,2,2011)),
}

def slugify(s):
    s = s.lower().replace("&","and")
    s = re.sub(r"[^a-z0-9]+","-",s).strip("-")
    return s[:60]

EXTRA = []

MAMA_DUR = [46.8,129.9,213.3,165.9,196.9,151.6,198.6,138.4]
MAMA_EMO = ["💐","🌸","🌷","🌼","🌻","🌺","🪷","💮"]
def mm(d): return f"{int(d//60)}:{int(round(d%60)):02d}"
for i,d in enumerate(MAMA_DUR,1):
    if i<=2 or i==8: note = "A recording all of its own."
    elif i==3: note = "The first part of the long recording. It carries on in the next tape."
    elif i==7: note = "The last part of the long recording."
    else: note = "Carries on from the previous tape, and on into the next."
    items_extra = dict(kind="audio", folder="Mama", file=f"Mama-Tape-{i:02d}.mp3", cat="mama", emoji=MAMA_EMO[i-1],
        title=f"Mama's Tape {i}", caption=f"Mama's memory tape {i} of 8 ({mm(d)}). {note}", date=None)
    EXTRA.append(items_extra)
items = []
for line in open(os.path.join(HERE, "clips.txt"), encoding="utf-8"):
    kind, fname, uid = line.rstrip("\n").split("|")
    stem = re.sub(r"\.(mp3|mp4)$","",fname)
    if kind == "V":
        m = re.match(r"^(.*?) \[([^\]]+)\]$", stem)
        base, yt = m.group(1), m.group(2)
        key = base if base in V else f"{base}#{yt}"
        cat, emo, title, cap, dt = V[key]
        items.append(dict(kind="video", folder="Video", file=fname, cat=cat, emoji=emo, title=title, caption=cap, date=dt))
    else:
        if stem in A:
            emo, title, cap, dt = A[stem]
        else:
            n = stem.replace("Soundclip","")
            emo, title, cap, dt = ("📼", f"Voice Tape #{n}", "A mystery tape from the voice archive. Who knows what she'll say? Press play!", None)
        items.append(dict(kind="audio", folder="Audio", file=fname, cat="tapes", emoji=emo, title=title, caption=cap, date=dt))

# Paper treasures and photos (pictures, not clips)
EXTRA.append(dict(kind="image", folder="Keepsakes", file="Rabbit-Pros-and-Cons.jpg", cat="keepsakes", emoji="🐰",
    title="Why We Should Get a Rabbit",
    caption="Her case for a rabbit, in her own handwriting: pros on the left, cons on the right, and tips along the bottom. Note the other pet crossed out in the title. Tap the picture to zoom in.", date=None))
EXTRA.append(dict(kind="image", folder="Keepsakes", file="Santa-2009.jpg", cat="keepsakes", emoji="🎅",
    title="With Santa, 2009",
    caption="One very small girl, one very large beard. The camera recorded 7 November 2009.", date=(7,11,2009)))

EXTRA.append(dict(kind="image", folder="Keepsakes", file="Drawing-2021.png", cat="keepsakes", emoji="🎨",
    title="A Room in Ink (2021)",
    caption="Her pen-and-wash drawing of a bedroom: the bed under the window, a clock on the wall, a shelf of little treasures, a teddy in the cupboard and a map by the door. Tap the picture to zoom in.", date=(None,None,2021), added="2026-09-25"))

# iPad drawings (titles/captions in art_clips.json)
EXTRA.extend(dict(it, date=None) for it in json.load(open(os.path.join(HERE, "art_clips.json"), encoding="utf-8")))

# When each memory appeared on the site (used for the "new since your last visit" sparkles).
ADDED_OLD, ADDED_MAMA_VIDEO, ADDED_KEEPSAKES = "2026-09-15", "2026-09-16", "2026-09-24"
for it in items: it["added"] = ADDED_OLD
for it in EXTRA: it.setdefault("added", ADDED_KEEPSAKES if it["cat"] == "keepsakes" else ADDED_OLD)
items.extend(EXTRA)
# Mama's wedding and ceremony clips (cut from the original discs; titles/captions in mama_video_clips.json)
for it in json.load(open(os.path.join(HERE, "mama_video_clips.json"), encoding="utf-8")):
    items.append(dict(it, date=None, added=ADDED_MAMA_VIDEO))
assert len(items) == 259, len(items)
# No upload/backup dates: only dates embedded in the original file names are shown (see V/A tables).
catorder = [c[0] for c in CATS]
def sortkey(it):
    d = it["date"] or (None,None,None)
    return (catorder.index(it["cat"]), it.get("order", 0), it["title"].lower())
items.sort(key=sortkey)
seen=set()
for it in items:
    s = slugify(it["file"][:-4]) if it["cat"] in ("mamawedding", "mamaceremony") else slugify(it["title"]); b=s; i=2
    while s in seen: s=f"{b}-{i}"; i+=1
    seen.add(s); it["slug"]=s
    it.pop("order", None)
    d = it.pop("date")
    if d:
        dd,mm,yy = d
        it["when"] = dstr(dd,mm,yy) if dd else (f"{['','January','February','March','April','May','June','July','August','September','October','November','December'][mm]} {yy}" if mm else str(yy))
cats = [dict(id=c[0], emoji=c[1], name=c[2], blurb=c[3], color=c[4], count=sum(1 for i in items if i["cat"]==c[0])) for c in CATS]
out = "// Generated: titles & captions for each memory. Files live in SharePoint (Papa's Memories › Documents).\nwindow.MEMORIES = " + json.dumps(dict(cats=cats, items=items), ensure_ascii=False, indent=1) + ";\n"
open(os.path.join(HERE, "..", "website", "memories.js"),"w",encoding="utf-8").write(out)
print({c["id"]:c["count"] for c in cats})
