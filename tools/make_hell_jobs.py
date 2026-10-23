# -*- coding: utf-8 -*-
"""難度 6「地獄」的生圖工作檔（2026-10-23）：35 隻新魔物＋尾王「魔源」四階段＋三張地獄戰鬥背景。

設計見 docs/superpowers/specs/2026-10-21-hell-difficulty-design.md。
10-23 使用者改：尾王不用黑化師父，改成「魔氣來源」的王、四階段（設計由我定，見下方「魔源」那段）。
規格同 make_wave3_monster_jobs.py（面朝左、綠幕去背、滿版、實心不透明），多一段「裡塔」的魔氣畫風。
每隻跟現有魔物一樣生四種姿勢：待機、出手、挨打、防禦；大魔物與關主（1024 那幾隻）多生倒下。
防禦、倒下的提示詞直接用 build_block_queue／build_down_queue 那兩段（踩過的坑都在裡面）。
出手以後的姿勢一律附自己的待機圖當參考（codex_gen 的單張 ref）。
工單排序：先全部待機與背景，再其他姿勢——參考圖在同一批前段就會生好。

跑法：
  python tools/make_hell_jobs.py                       → tools/codex_jobs/hell_all.json
  python tools/codex_gen.py tools/codex_jobs/hell_all.json
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
from build_block_queue import BLOCK_POSE, BLOCK_TAIL  # noqa: E402
from build_down_queue import DOWN_POSE, DOWN_TAIL  # noqa: E402

MID = """

It stands (or floats just above) the ground with its feet at the very bottom edge of the picture.
Fill the frame vertically: the monster should reach nearly the top and the bottom of the image.
Readable at small size: bold silhouette, strong shapes, a clear cartoon face.
Draw everything SOLID and OPAQUE - flat filled colour with soft shading. Nothing transparent or see-through.
Nothing else in the picture: no ground line, no shadow, no scenery, no text, no letters, no numbers, no watermark, no border.
Style: thick black outlines, flat colors with subtle soft gradients, cute cartoon look, not photorealistic.
ANATOMY RULE: count the limbs before finishing - exactly the number described, no extra arms or legs.
Background must be a solid pure green (#00FF00), completely flat, for chroma keying. Nothing green in the monster
itself unless the description says so.
Output {SIZE} PNG. Save the image as {ID} in the current directory and report the path."""

HELL = ("This is the HELL version of the tower: the 'inner tower' completely swallowed by purple miasma. "
        "Its monsters are yokai twisted by demonic energy - darker palette of deep purple, black and crimson accents, "
        "glowing purple eyes, small wisps of dark purple smoke drawn as solid shapes - but still cute cartoon game monsters, "
        "not gory, not realistic horror.\n\n")

HURT = ("at the moment it gets HIT: recoiling backwards (to the right, since it faces left), body tilted back, eyes squeezed "
        "shut or wide in shock, mouth open in an 'ouch', a couple of small impact stars near the head")

SAME = "Use the attached image as the exact character design: same body, colours, outfit and proportions, only the pose changes.\n\n"

idle_jobs, later_jobs = {}, {}


def mon(name, desc, idle, attack, size='768x768', down=None, idle_ref=None, kind='monster'):
    """down 沒指定時：1024 的（大魔物、關主）才生倒下。idle_ref：待機圖也要附參考時用（魔源的後三階段）。"""
    head = ("A single cartoon %s for a cute game set in a cat ninja tower (Japanese yokai flavour), full body, facing left.\n\n"
            % kind + HELL + "The monster: " + desc)
    idle_id = "monster_hell_%s_idle.png" % name
    ref = "tools/codex_raw/" + idle_id
    if down is None:
        down = size == '1024x1024'
    for pose, text in [('idle', idle), ('attack', attack), ('hurt', HURT)]:
        fid = "monster_hell_%s_%s.png" % (name, pose)
        prompt = head + "\n\nPose: " + text + MID.replace('{SIZE}', size).replace('{ID}', fid)
        if pose == 'idle':
            idle_jobs[fid] = {"prompt": EVOLVE + prompt, "ref": idle_ref} if idle_ref else prompt
        else:
            later_jobs[fid] = {"prompt": SAME + prompt, "ref": ref}
    for pose, body, tail in [('block', BLOCK_POSE, BLOCK_TAIL)] + ([('down', DOWN_POSE, DOWN_TAIL)] if down else []):
        fid = "monster_hell_%s_%s.png" % (name, pose)
        later_jobs[fid] = {"prompt": "The creature: " + desc + body + tail.format(name=fid), "ref": ref}


# ===== 第一關「快」：紫霧倒數。越活越強、叫增援、逃跑帶走戰利品、自爆倒數 =====
mon('fuse_imp',
    "a small round black bomb-shaped imp with a cheeky grin, stubby arms and legs, a short fuse on top of its head burning "
    "with a purple spark, cracks glowing purple on its round body; two arms, two legs",
    "standing on tiptoe, fuse fizzing, grinning nervously",
    "leaping to the LEFT arms spread wide, fuse spark flaring big, about to burst", size='512x512')
mon('hourglass_moth',
    "a big moth yokai whose body is a dark wooden hourglass filled with glowing purple sand, four tattered black-and-violet "
    "wings with eye patterns, two feathery antennae, a small fierce face on the top of the hourglass; four wings, no legs",
    "hovering just above the ground, wings half open, sand trickling inside its body",
    "swooping to the LEFT with wings flung forward, a burst of purple sand dust blown ahead")
mon('loot_weasel',
    "a skinny kamaitachi weasel thief with sickle-shaped claws, a black bandit mask over the eyes, a bulging cloth loot sack "
    "slung over one shoulder with gold coins peeking out; two arms, two legs",
    "crouched low ready to dash away, looking back over its shoulder with a sly grin, sack held tight",
    "slashing to the LEFT with one sickle claw, sack swinging behind, body stretched in a fast dash")
mon('drum_tanuki',
    "a plump tanuki raccoon-dog yokai with dark purple-tinted fur, a straw hat with a torn brim, beating its own round belly "
    "like a war drum with two drumsticks, eyes glowing purple; two arms, two legs",
    "standing proudly, drumsticks raised, belly puffed out",
    "pounding its belly drum hard, shockwave rings bursting out to the LEFT, mouth open shouting")
mon('onibi_rats',
    "a tight cluster of four small black rats, each with a little purple will-o'-wisp flame floating above its head, "
    "red beady eyes, scurrying together as one group; each rat has four legs",
    "huddled together in a squeaking pile, flames bobbing",
    "the whole pack charging to the LEFT with flames streaking behind", size='512x512')
mon('candle_monk',
    "a short candle yokai: a thick melting violet candle as its body with a stern little monk face, a burning purple flame on "
    "top as its hair, wax drips like a robe, two small wax arms holding prayer beads; two arms, two short legs",
    "standing still with eyes closed, flame tall and steady, beads in hand",
    "flinging hot wax drops to the LEFT, flame roaring high, eyes snapped open", size='512x512')
mon('fire_wheel',
    "a wanyudo: a large wooden ox-cart wheel engulfed in purple and crimson flames, with an angry horned oni face in the "
    "centre hub; no arms or legs",
    "standing upright on its rim, spinning slowly, face scowling",
    "rolling at full speed to the LEFT, flames streaking behind it in long trails")
mon('miasma_bud',
    "a twisted carnivorous flower bud yokai, dark violet petals closed like a fist with sharp teeth along the seams, a thick "
    "thorny maroon stem rooted in a small clump of black soil, two leaf-hands with claws; no legs",
    "swaying slowly, petals slightly parted showing a hungry glow inside",
    "lashing to the LEFT, petals bursting open into a huge toothy mouth")
mon('clock_oni',
    "a big crimson oni with two horns, wearing black samurai shoulder guards, carrying a huge bronze temple gong shaped like "
    "a clock face on its back, holding a heavy mallet, glowing purple eyes; two arms, two legs",
    "standing firm, mallet resting on its shoulder, gong looming behind it",
    "swinging the mallet in a big arc to the LEFT, gong ringing with shockwave lines", size='1024x1024')
mon('rush_boar',
    "a giant wild boar yokai in cracked black armour plates, huge curved tusks, a bristling mane burning with purple flame, "
    "glowing eyes, steam from its nostrils; four legs",
    "pawing the ground with one front hoof, head lowered, snorting",
    "charging head-first to the LEFT at full speed, tusks forward, mane flames streaming back", size='1024x1024')
mon('sand_golem',
    "a hulking golem made of dark stone blocks with a giant hourglass set into its chest, purple sand pouring between the "
    "blocks, a small glowing purple face slit, heavy block fists; two arms, two legs",
    "standing heavy and still, sand slowly flowing in the chest hourglass",
    "slamming both block fists down to the LEFT, a spray of purple sand bursting out", size='1024x1024')
mon('hourglass_shogun',
    "the first boss: a towering skeletal yokai shogun in black lacquered samurai armour with purple cords, a horned kabuto "
    "helmet, glowing purple eyes in a shadowed face, a giant hourglass embedded in its breastplate with purple sand, a long "
    "tattered crimson cape, holding a huge nodachi sword; two arms, two legs",
    "standing tall and imposing, sword planted point-down in front, cape billowing",
    "a wide sweeping sword slash to the LEFT leaving a purple arc, cape flaring", size='1024x1024')

# ===== 第二關「亂」：偷牌、封牌、往牌組塞東西。牌一律畫成空白牌背，不要字 =====
mon('pickpocket_monkey',
    "a lanky dark-furred monkey yokai in a patched purple vest full of pockets, a long curling tail, nimble fingers clutching "
    "a stolen playing card with a plain blank back, smug face; two arms, two legs",
    "hanging off-balance on one foot, waving the stolen card teasingly",
    "lunging to the LEFT with a long arm outstretched to snatch, tail whipping")
mon('ofuda_ghost',
    "a floating ghost made of a long paper talisman strip, pale cream paper with a big red circular seal stamp and plain ink "
    "swirl marks (no readable letters), two narrow glaring eyes, a ragged bottom edge instead of legs, two paper-strip arms",
    "floating upright, paper edges fluttering",
    "stretching out to the LEFT, flinging a smaller paper seal talisman forward", size='512x512')
mon('magpie_tengu',
    "a crow tengu with glossy black-and-white magpie feathers, a long beak, small black tokin cap, carrying a twig nest full "
    "of shiny trinkets and blank playing cards; two arms with feathered sleeves, two legs, two wings",
    "standing hunched over its nest, hugging it greedily",
    "diving to the LEFT with talons forward and wings spread, beak open")
mon('junk_mimic',
    "a treasure chest mimic yokai, dark wood with dented iron bands, a long purple tongue, rows of teeth in the lid, junk "
    "spilling out: broken sandals, crumpled blank cards, cracked teacups; two short stubby legs",
    "sitting with the lid slightly open, tongue lolling out",
    "lid flung wide open spitting a stream of junk to the LEFT")
mon('ink_octopus',
    "a purple octopus yokai wearing a scholar's black hat, holding brushes and rolled blank scrolls in its tentacles, ink "
    "smudges on its cheeks; exactly eight tentacles, no arms or legs",
    "sitting on coiled tentacles, scrolls tucked away, looking smug",
    "spraying a big splash of black ink to the LEFT from its mouth, tentacles flung out")
mon('lock_spider',
    "a spider yokai whose round body is a big iron padlock with a keyhole, eight thin black legs, a cluster of small purple "
    "eyes above the keyhole, iron chains instead of silk; exactly eight legs",
    "crouched low on its eight legs, chains draped around it",
    "shooting a tangle of chains to the LEFT, front legs raised")
mon('shuffle_fox',
    "a sly white kitsune fox with two fluffy tails tipped in purple, a red-and-black jester-like haori, juggling a fan of "
    "blank playing cards in the air, narrow smiling eyes; two arms, two legs, two tails",
    "standing on one foot juggling cards in an arc overhead",
    "flicking a spray of spinning cards to the LEFT like shuriken")
mon('trash_goblin',
    "a squat goblin yokai made of a tied-up dark garbage sack with stubby limbs, one big eye, a fish bone sticking out, "
    "dragging a smaller sack of junk; two arms, two legs",
    "standing with the junk sack slung over its shoulder, grinning",
    "hurling a handful of junk to the LEFT, sack flapping", size='512x512')
mon('vault_tortoise',
    "a giant old tortoise yokai whose shell is a massive round iron vault door with a dial lock and rivets, a long white "
    "beard, sleepy but grumpy face, thick scaly legs; four legs",
    "planted firmly on four legs, eyes half-closed, shell locked shut",
    "snapping its head forward to the LEFT, jaws wide, the vault shell glowing purple", size='1024x1024')
mon('card_dragon',
    "a long serpentine eastern dragon made entirely of crumpled and folded blank playing cards and paper, purple ink "
    "splotches like scales, glowing purple eyes, paper whiskers; two small clawed arms, no legs",
    "coiled in an S-shape, head raised, paper scales rustling",
    "lunging to the LEFT with jaws open, a gust of loose blank cards blasting out", size='1024x1024')
mon('chain_warden',
    "a huge jailer oni with dark blue skin, an iron mask over the lower face, heavy shackles on the wrists with long "
    "chains, a giant ring of keys on its belt, glowing purple eyes; two arms, two legs",
    "standing with chains wrapped around its fists, keys jangling",
    "whipping a long chain forward to the LEFT, shackles swinging", size='1024x1024')
mon('hoarder_toad',
    "the second boss: an enormous fat toad daimyo lord with dark purple warty skin, a lavish crimson-and-gold kimono, a "
    "tall black eboshi hat, a long sticky tongue, sitting on a heap of stolen blank cards and sealed scrolls, holding a "
    "giant wooden seal stamp; two arms, two legs",
    "lounging on the heap, stamp resting on its knee, greedy grin",
    "slamming the giant seal stamp down to the LEFT, tongue lashing out", size='1024x1024')

# ===== 第三關「狡猾」：互相配合、看穿玩家常用打法。要能多隻同場 =====
mon('shell_kappa',
    "a sturdy kappa yokai with slate-blue skin, a dish on top of its head, a beak, carrying a huge round turtle-shell shield "
    "on one arm, a short spear in the other; two arms, two legs",
    "standing guard with the shield raised in front, peeking over it",
    "shield-bashing forward to the LEFT, spear tucked behind")
mon('banner_imp',
    "a small red oni imp waving a tall war banner pole with a plain crimson flag (no symbols, no letters), a war drum on "
    "its back, puffed cheeks shouting; two arms, two legs",
    "planting the banner proudly, chest out",
    "swinging the banner pole down to the LEFT like a club", size='512x512')
mon('medicine_bat',
    "a round bat yokai with purple fur and big leathery wings, wearing a tiny white apron, carrying a medicine gourd and a "
    "bundle of herbs; two wings, two small feet",
    "hovering, gourd held close, flapping gently",
    "diving to the LEFT, flinging a splash of bitter medicine from the gourd", size='512x512')
mon('twin_moon',
    "one of a pair of twin cat swordswomen: a slim black cat in a silver-and-indigo kimono with crescent moon patterns, a "
    "crescent moon hair ornament, holding a curved silver blade, cool calm eyes; two arms, two legs",
    "standing in a poised stance, blade held low behind her",
    "a fast crescent slash to the LEFT leaving a silver arc")
mon('twin_sun',
    "one of a pair of twin cat swordswomen: a slim orange cat in a crimson-and-gold kimono with sun patterns, a sun disc "
    "hair ornament, holding a straight golden blade, fierce fiery eyes; two arms, two legs",
    "standing in an aggressive stance, blade raised over her head",
    "a powerful downward chop to the LEFT trailing golden sparks")
mon('mirror_eye',
    "a floating round bronze mirror yokai with ornate engraved rim, a single huge purple eye in the mirror surface, "
    "tassels hanging below; no arms or legs",
    "hovering, the eye glancing sideways, tassels swaying",
    "flaring a beam of purple light from the eye to the LEFT", size='512x512')
mon('strategist_owl',
    "a wise horned owl yokai in a dark purple strategist robe and a black scholar cap, holding a feather fan and an abacus, "
    "monocle over one glowing eye; two wings used as arms, two legs",
    "standing calmly fanning itself, eyes narrowed and calculating",
    "pointing the feather fan to the LEFT commanding an attack, robe swirling")
mon('smoke_rat',
    "a ninja rat in a black shinobi outfit and a purple scarf, a mask over the mouth, holding a kunai, a smoke bomb in the "
    "other paw; two arms, two legs, one long tail",
    "crouched low ready to vanish, eyes darting",
    "throwing the kunai to the LEFT while a puff of solid grey smoke swirls behind")
mon('three_face_ashura',
    "a giant ashura warrior yokai with three faces on one head (angry, laughing and calm), four arms each holding a "
    "different weapon (sword, spear, bow, bell), purple-grey skin, flowing crimson sash; exactly four arms, two legs",
    "standing in a wide stance, four arms spread, the three faces looking in different directions",
    "striking to the LEFT with all four weapons at once", size='1024x1024')
mon('nue',
    "a nue chimera yokai: a monkey face with glowing purple eyes, a stout tanuki body, striped tiger legs, and a snake for a "
    "tail with its own little head, dark storm-cloud fur; four legs, one snake tail",
    "prowling low, snake tail hissing upward",
    "pouncing to the LEFT with claws out while the snake tail strikes forward", size='1024x1024')
mon('bone_commander',
    "a giant gashadokuro skeleton yokai, huge cartoony skull with purple fire in the eye sockets, wearing a tattered black "
    "general's jinbaori coat, holding a war fan for commanding troops; two arms, two legs",
    "standing tall, war fan raised to give orders, jaw grinning",
    "swinging a huge bony hand down to the LEFT, war fan pointing forward", size='1024x1024')

# ===== 尾王「魔源・紫冥」四階段（10-23 使用者：尾王不要師父，改做魔氣來源的王、四階段，設計交給我）=====
# 設定：塔底封著的古老妖物，封印的注連繩斷了、紫霧從它身上漏出來，師父就是想獨自封回去才走火入魔。
# 四階段對應原設計的三種難＋全部：①紫霧之繭（快）②破繭・千手（亂：偷牌封牌）③千面（狡猾：看穿、號令手下）④真身（三種一起＋模仿）。
# 檔名照現有關主換階段的規矩：第一階段＝原鍵，之後 _p2、_p3、_p4（assets.ts 的 monsterPhaseKey）。
# 四個形態共用的記號：胸口裂開的紫水晶心臟（魔氣的源頭）、斷掉的注連繩、金色豎瞳——小怪是紫眼，王用金眼分開。
CORE = ("Its signature, present in every form: a large cracked violet crystal heart glowing in the middle of its body (the "
        "source of all the purple miasma in the tower), pieces of a torn sacred shimenawa straw rope with white paper zigzag "
        "streamers (the broken seal that once held it), and golden slit-pupil cat eyes. ")
EVOLVE = ("The attached image is this SAME boss in its previous form. It has now transformed: keep the cracked violet crystal "
          "heart, the torn shimenawa rope, the golden slit-pupil eyes and the colour palette so it is clearly the same being, "
          "but the body shape is new, as described below.\n\n")
mon('source',
    CORE + "The final boss, first form 'the Miasma Cocoon': a huge pulsing cocoon of swirling dark purple miasma drawn as "
    "solid layered shapes, bound by the torn shimenawa rope and peeling paper talismans (no readable letters), the crystal "
    "heart showing through a split in the front, one enormous golden slit-pupil cat eye staring out above it, small shadow "
    "cat paws pressing against the inside of the cocoon wall; no arms or legs",
    "hovering just above the ground, slowly pulsing, the giant eye glaring",
    "the cocoon splitting open at the front to blast a wave of purple miasma to the LEFT, the eye blazing",
    size='1024x1024', down=False, kind='boss')
mon('source_p2',
    CORE + "The final boss, second form 'Thousand Hands': the cocoon has hatched into a tall slender shadow cat demon with "
    "sleek black fur, long torn black-and-violet kimono sleeves, SIX long clawed arms (two real arms plus four shadow arms "
    "growing from its back), the crystal heart glowing in its chest, shreds of the cocoon and the torn rope still hanging "
    "from its shoulders; exactly six arms, two legs",
    "standing tall with the six hands spread like a fan, two of the hands pinching stolen playing cards with plain blank backs",
    "all six hands lunging to the LEFT to snatch, claws wide open",
    size='1024x1024', down=False, kind='boss', idle_ref="tools/codex_raw/monster_hell_source_idle.png")
mon('source_p3',
    CORE + "The final boss, third form 'Thousand Faces': the same six-armed shadow cat demon, now taller, its face hidden "
    "behind a cracked white Noh-style cat mask with golden eye holes, a ring of six floating masks orbiting its head (an angry "
    "oni, a laughing fox, a crying face, a sleeping face, a sly tanuki, a blank face), the six hands gripping a war fan, a "
    "round mirror, a bell, a chain, a brush and a sword, the crystal heart brighter; exactly six arms, two legs",
    "standing calm and arrogant, masks circling, one hand raised as if reading the player's next move",
    "the floating masks and all six weapons striking together to the LEFT",
    size='1024x1024', down=False, kind='boss', idle_ref="tools/codex_raw/monster_hell_source_p2_idle.png")
mon('source_p4',
    CORE + "The final boss, true form 'Shimei, the Source of Miasma': a colossal nine-tailed black cat god, regal and "
    "terrifying but still drawn in the cute cartoon style, sleek black fur with glowing violet stripes, a crown of purple "
    "flame, a huge dark eclipse halo ring behind its head, nine long tails each tipped with a purple flame, the crystal heart "
    "fully exposed and blazing in its chest, broken pieces of the cocoon, the masks and the rope fused into armour-like "
    "shoulder ornaments; two arms, two legs, nine tails",
    "standing upright like a god, arms crossed, nine tails fanned out behind, flames blazing",
    "thrusting one clawed hand to the LEFT unleashing a torrent of black-and-purple flame, tails whipping forward",
    size='1024x1024', down=True, kind='boss', idle_ref="tools/codex_raw/monster_hell_source_p3_idle.png")

# ===== 地獄戰鬥背景（每關一張）：照現行背景的構圖與地平線 =====
BG = """A wide background painting for a cartoon game battle screen, seen straight on like a stage set.
Use the attached image only for LAYOUT: keep the same camera angle and exactly the same height of the floor line.

The room: {ROOM}

CRITICAL - THE FLOOR LINE: the boundary between the wall and the floor must sit at the same height as in the attached
image (about 56% of the image height from the top). The characters stand with their feet on that line.
Leave the middle of the picture relatively plain and uncluttered - characters stand there and must stay readable.
Push the interesting detail to the left and right thirds.
No characters, no creatures, no text, no letters, no watermark, no border, no user interface.
Style: thick outlines, flat colors with soft shading, cute cartoon look, dark and eerie but not gory, not photorealistic.
Output 1280x720 PNG. Save the image as {ID} in the current directory and report the path."""
for i, (ref, room) in enumerate([
        ('art26_low_1', "the bottom floor of the 'inner tower' swallowed by thick purple miasma: a ruined storehouse, broken "
                        "crates, a huge cracked hourglass lying on its side spilling purple sand, melted candles, purple fog "
                        "rolling along the floor, dim violet light"),
        # 10-23 第一版太像普通書庫（暖色木地板、紫霧太淡），使用者要重生：改成黑石地板、冷色、紫霧要濃
        ('art26_mid_1', "the middle floor of the 'inner tower' swallowed by purple miasma: a ruined vault and library, toppled "
                        "black shelves, scattered blank playing cards and torn scrolls, iron chains and padlocks hanging from "
                        "the beams, paper talismans on cracked pillars. The floor is cold dark grey-violet STONE tiles, not wood. "
                        "The whole room is lit only by dim violet light and purple flames - no warm orange or yellow lamps. "
                        "Thick purple fog rolls along the floor and drifts up the walls, the same eerie mood as the bottom floor"),
        ('art26_top_1', "the rooftop of the 'inner tower' under a huge purple-black eclipse moon, cracked stone floor, broken "
                        "railings, torn war banners, black-and-purple flames on the stone lanterns, storm clouds swirling"),
], start=1):
    fid = "bg_hell_%d.png" % i
    idle_jobs[fid] = {"prompt": BG.replace('{ROOM}', room).replace('{ID}', fid),
                      "ref": "tools/codex_jobs/hell_refs/%s.png" % ref}   # 原檔 webp 轉成 png，codex -i 比較穩

jobs = {**idle_jobs, **later_jobs}
monsters = {k.rsplit('_', 1)[0] for k in jobs if k.startswith('monster_hell_') and '_source' not in k}
assert len(monsters) == 35, len(monsters)
out = ROOT / 'tools' / 'codex_jobs' / 'hell_all.json'
out.write_text(json.dumps(jobs, ensure_ascii=False, indent=1), encoding='utf-8')
n_boss = sum('_source' in k for k in jobs)
print(len(jobs), '張（魔物', len(monsters), '隻、魔源', n_boss, '張、背景 3 張）→', out)
