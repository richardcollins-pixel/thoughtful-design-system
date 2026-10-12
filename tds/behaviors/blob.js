// Blob and glow. The animated gradient shape (atoms/blob) and its blurred copy (atoms/glow).
//
// The blob bounces slowly up and down, its outline morphs slowly, and its colours travel round the outside of the shape while the
// colour theme shifts every few seconds. In special cases it morphs into another shape (pencil, chat bubble, envelope, chat) to
// stand for something; its default is always the plain blob. The glow is a blurred copy of it: right behind a blob (it then follows
// that blob's shape and colours) or, more usually, on its own near the bottom of a screen.
//
// You do not call this: put the markup on the page and set attributes, and this file finds it (now and later) and keeps it in sync.
//   <div class="blob" data-shape="blob" data-theme="auto"></div>            data-shape: blob | pencil | bubble | envelope | chat
//   <div class="glow" data-theme="auto" data-placement="bottom"></div>      data-theme: auto | cool | warm | rose | ember | bloom
//   <div class="blob" id="t"></div> <div class="glow" data-for="t"></div>   a glow tied to the blob with that id (placement "behind")
// Changing data-shape / data-theme morphs it. In code: TBlob.create(canvas, opts) returns { setShape, setTheme, destroy }.
//
// Ported from the loading prototype (the polar shapes with bloblets: blob, pencil, bubble) and the intro prototype (the traced
// outlines with a detaching flap and dot: envelope, chat). They are two engines; one blob uses whichever its shape needs and
// hands over through the plain blob, so any shape can follow any other. Every instance is independent (the prototypes were
// singletons), and one animation loop drives them all, pausing the ones that are off screen.

/* ------------------------------------------------------------------ presets (colour themes) */
const COOL  = { name: 'Cool',  base: '#3F0786', spots: [{ angle: Math.PI*0.75, r: 1.8, color: '#2CC5E9', opacity: 1.0 }, { angle: Math.PI*0.60, r: 1.4, color: '#591E9A', opacity: 0.70 }] };
const WARM  = { name: 'Warm',  base: '#3F0786', spots: [{ angle: Math.PI*0.75, r: 1.8, color: '#F57F70', opacity: 1.0 }, { angle: Math.PI*0.60, r: 1.4, color: '#852A9C', opacity: 0.85 }] };
const ROSE  = { name: 'Rose',  base: '#591E9A', spots: [{ angle: Math.PI*0.75, r: 1.8, color: '#F57F70', opacity: 1.0 }, { angle: Math.PI*0.60, r: 1.4, color: '#683A94', opacity: 0.85 }] };
const EMBER = { name: 'Ember', base: '#9C2A6A', spots: [{ angle: -Math.PI*0.28, r: 1.65, color: '#EE8A5C', opacity: 1.00 }, { angle: Math.PI*0.72, r: 1.50, color: '#8B1F63', opacity: 0.90 }] };
const BLOOM = { name: 'Bloom', base: '#7C1F6B', spots: [{ angle: -Math.PI*0.20, r: 1.75, color: '#F0708C', opacity: 1.00 }, { angle: Math.PI*0.76, r: 1.45, color: '#A82A80', opacity: 0.85 }] };
export const THEMES = { cool: COOL, warm: WARM, rose: ROSE, ember: EMBER, bloom: BLOOM };
const CYCLE = [COOL, WARM, ROSE];                 // what "auto" moves through
const CYCLE_EVERY_MS = 5000, CYCLE_FADE_MS = 4500;  // a new theme every 5s, crossfaded slowly

export const SHAPES = ['blob', 'pencil', 'bubble', 'envelope', 'chat'];
const TRACED = new Set(['envelope', 'chat']);

/* ================================================================== engine 1: polar shapes (blob, pencil, bubble) + bloblets */
function createPolarEngine() {
  'use strict';

  var TAU = Math.PI * 2;

  /* ---------- colour helpers (unchanged) ---------- */
  function hexRgb(h) {
    return [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
  }
  function lerpColor(a, b, t) {
    var c1 = hexRgb(a), c2 = hexRgb(b);
    return '#' + [0,1,2].map(function (i) {
      return Math.round(c1[i] + (c2[i]-c1[i])*t).toString(16).padStart(2,'0');
    }).join('');
  }
  function lerpPreset(p1, p2, t) {
    return {
      base: lerpColor(p1.base, p2.base, t),
      spots: p1.spots.map(function (s, i) {
        var s2 = p2.spots[i] || s;
        return {
          angle:   s.angle   + (s2.angle   - s.angle)   * t,
          r:       s.r       + (s2.r       - s.r)       * t,
          color:   lerpColor(s.color, s2.color, t),
          opacity: s.opacity + (s2.opacity - s.opacity) * t
        };
      })
    };
  }

  /* ---------- gradient painting (unchanged) ---------- */
  function paintGradient(ctx, preset, W, H, orbit) {
    var CX = W/2, CY = H/2, R = Math.min(W,H) * 0.37;
    var b = hexRgb(preset.base);
    ctx.fillStyle = 'rgb(' + b[0] + ',' + b[1] + ',' + b[2] + ')';
    ctx.fillRect(0, 0, W, H);
    preset.spots.forEach(function (s) {
      var a = s.angle + orbit,
          sx = CX + Math.cos(a)*R, sy = CY + Math.sin(a)*R, sr = s.r * R;
      var c = hexRgb(s.color);
      var grd = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
      grd.addColorStop(0, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + s.opacity + ')');
      grd.addColorStop(1, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, W, H);
    });
  }

  /* ---------- presets ---------- */
  /* original three, kept so existing screens keep working */
  var COOL  = { name:'Cool',  base:'#3F0786', spots:[{angle:Math.PI*0.75,r:1.8,color:'#2CC5E9',opacity:1.0},{angle:Math.PI*0.60,r:1.4,color:'#591E9A',opacity:0.70}] };
  var WARM  = { name:'Warm',  base:'#3F0786', spots:[{angle:Math.PI*0.75,r:1.8,color:'#F57F70',opacity:1.0},{angle:Math.PI*0.60,r:1.4,color:'#852A9C',opacity:0.85}] };
  var ROSE  = { name:'Rose',  base:'#591E9A', spots:[{angle:Math.PI*0.75,r:1.8,color:'#F57F70',opacity:1.0},{angle:Math.PI*0.60,r:1.4,color:'#683A94',opacity:0.85}] };
  /* new — matches the loading screen's "gradient/dark rose to orange" (#9C2A6A) */
  var EMBER = { name:'Ember', base:'#9C2A6A', spots:[{angle:-Math.PI*0.28,r:1.65,color:'#EE8A5C',opacity:1.00},{angle:Math.PI*0.72,r:1.50,color:'#8B1F63',opacity:0.90}] };
  var BLOOM = { name:'Bloom', base:'#7C1F6B', spots:[{angle:-Math.PI*0.20,r:1.75,color:'#F0708C',opacity:1.00},{angle:Math.PI*0.76,r:1.45,color:'#A82A80',opacity:0.85}] };

  /* ==================================================================
     SHAPES — normalised polar silhouettes
     Each profile(a) returns a radius in units of the base radius, where
     ~1.0 is "touching the edge of the mount". Because every shape is a
     function of angle only, morphing between any two is a straight lerp
     of radii; and the legacy wobble (and the new morph energy) can be
     applied as a clean multiplier afterwards.
     ================================================================== */
  function superellipse(d, A, B, n) {
    var c = Math.abs(Math.cos(d) / A), s = Math.abs(Math.sin(d) / B);
    return Math.pow(Math.pow(c, n) + Math.pow(s, n), -1 / n);
  }
  /* asymmetric on the y axis: Bup governs -y (screen up), Bdn governs +y */
  function asymSuperellipse(d, A, Bup, Bdn, n) {
    var sd = Math.sin(d);
    return superellipse(d, A, sd < 0 ? Bup : Bdn, n);
  }
  function angDist(a, b) {
    var d = (a - b) % TAU;
    if (d >  Math.PI) d -= TAU;
    if (d < -Math.PI) d += TAU;
    return d;
  }
  /* a narrow gaussian bump in the radius — used for points and tails */
  function spike(a, at, width, amp) {
    var d = angDist(a, at);
    return amp * Math.exp(-(d * d) / (width * width));
  }

  /* ---------- polygon → polar table ----------
     Some silhouettes can't be written as a tidy r(theta). A pencil is the
     example: it needs parallel sides and a cone that converges to a point,
     and in polar coordinates angle and distance-along-the-axis are not
     proportional, so every analytic attempt collapsed into either an oval
     (symmetric exponent), a paisley (exponent varied around the shape), or
     a whisker on a blob (width tapered near the tip). Drawing the outline
     and measuring it is both simpler and exact.

     Ray-casts the polygon once at load into a radius table, normalised so
     the furthest point is 1.0, and returns an interpolating profile(a) that
     drops straight into SHAPES alongside the analytic ones. The polygon must
     be star-shaped about its bounding-box centre (any ray from the centre
     crosses the outline exactly once) — true of every shape here. */
  var PROFILE_TABLE_N = 512;
  function polygonProfile(poly, rot) {
    var xs = [], ys = [], i, j;
    for (i = 0; i < poly.length; i++) { xs.push(poly[i][0]); ys.push(poly[i][1]); }
    var cx = (Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2;
    var cy = (Math.min.apply(null, ys) + Math.max.apply(null, ys)) / 2;
    var cr = Math.cos(rot), sr = Math.sin(rot), P = [];
    for (i = 0; i < poly.length; i++) {
      var x = poly[i][0] - cx, y = poly[i][1] - cy;
      P.push([x * cr - y * sr, x * sr + y * cr]);
    }
    var tab = new Array(PROFILE_TABLE_N), max = 0;
    for (i = 0; i < PROFILE_TABLE_N; i++) {
      var a = (i / PROFILE_TABLE_N) * TAU,
          dx = Math.cos(a), dy = Math.sin(a), best = 0;
      for (j = 0; j < P.length; j++) {
        var p1 = P[j], p2 = P[(j + 1) % P.length];
        var ex = p2[0] - p1[0], ey = p2[1] - p1[1];
        var den = dx * ey - dy * ex;
        if (Math.abs(den) < 1e-12) continue;
        var t = (p1[0] * ey - p1[1] * ex) / den;   /* along the ray  */
        var u = (p1[0] * dy - p1[1] * dx) / den;   /* along the edge */
        if (t > 0 && u >= -1e-9 && u <= 1 + 1e-9 && t > best) best = t;
      }
      tab[i] = best;
      if (best > max) max = best;
    }
    for (i = 0; i < PROFILE_TABLE_N; i++) tab[i] /= max;
    return function (ang) {
      var f = ((ang % TAU) + TAU) % TAU / TAU * PROFILE_TABLE_N;
      var i0 = Math.floor(f), w = f - i0;
      return tab[i0 % PROFILE_TABLE_N] * (1 - w) +
             tab[(i0 + 1) % PROFILE_TABLE_N] * w;
    };
  }

  /* Pencil outline, drawn along +x with the point at -x: a parallel-sided
     barrel, a blunt rounded butt, and a long cone.
     The cone runs from x=-0.34 to the tip at x=-1.00 against a half-width
     of 0.30 — an apex half-angle of ~24°. Shortening the cone widens that
     angle and the point starts reading as a chisel. */
  var PENCIL_POLY = [
    [-1.00,  0.00],                                   /* the point        */
    [-0.34,  0.30], [ 0.76,  0.30],                   /* upper barrel     */
    [ 0.90,  0.26], [ 0.96,  0.14], [ 0.98,  0.00],   /* rounded butt     */
    [ 0.96, -0.14], [ 0.90, -0.26],
    [ 0.76, -0.30], [-0.34, -0.30]                    /* lower barrel     */
  ];

  /* `wobble` scales the ANGULAR RIPPLE only (see radiusAt). The uniform
     breath, the bounce and the travelling gradient are global and run on
     every shape without exception — so all of them stay continuously alive;
     only the outline changes. */
  var SHAPES = {
    /* the blob: a plain circle, shaped entirely by the wobble.
       Unchanged from the original t-avatar component. */
    blob: {
      label: 'Blob',
      wobble: 1.00,
      profile: function () { return 1.00; }
    },

    /* Figma 162:19365 (Union) — the pencil, "finishing up my notes".
       Point down-left. Built from PENCIL_POLY rather than a formula: the
       sharp tip is the whole reason this reads as a pencil and not an oval,
       and a tip is what polar formulas are worst at. */
    pencil: {
      label: 'Pencil',
      wobble: 0.32,   /* ripple only; the breath is global */
      profile: polygonProfile(PENCIL_POLY, -Math.PI * 0.28)
    },

    /* Figma 162:19387 — the chat bubble, "packaging it up for you".
       Wide, flat pillow (roughly 1.7 : 1) with a SHORT tail. The long
       drooping tail of the old version was most of why it read as a brain. */
    bubble: {
      label: 'Chat bubble',
      wobble: 0.30,   /* ripple only; the breath is global */
      profile: function (a) {
        var body = asymSuperellipse(a, 1.00, 0.66, 0.50, 3.00);
        return body + spike(a, Math.PI * 0.55, 0.32, 0.38);
      }
    }
  };

  /* ---------- easing: overshoot, for a transition with some snap ---------- */
  /* ---------- morph easing: ONE motion ----------
     This used to be two eases composed, easeOutBack(easeInOutCubic(raw)),
     which read as two separate steps because that is literally what it was:
     measured over the curve, it overshot the target by 2% and then spent 41%
     of the morph travelling BACKWARD to settle onto it. A forward move
     followed by a distinct reverse move.
     Smootherstep (Perlin's) is a single monotonic motion — it never passes
     its target, never reverses, and has zero first AND second derivative at
     both ends, so it starts and stops without any jerk to mark a boundary.
     One velocity peak, dead centre. */
  function smootherstep(p) {
    return p * p * p * (p * (p * 6 - 15) + 10);
  }

  /* ---------- path construction ---------- */
  /* 384, not 256: the pencil's tip is a genuine corner and needs the
     angular resolution to survive both the sampling and the smoothing. */
  var STEPS = 384;
  var GLOW_FLATTEN = 0.45; /* 0 = always a circle, 1 = an exact copy of the blob */

  /* Angular smoothing. The radius profile is low-pass filtered before the
     path is built, which rounds off every corner in one place: the tip of
     the bubble's tail, the ends of the pencil, and — the reason it exists —
     the transient spikes the morph throws off when two very different
     profiles are being interpolated. Raise for softer, lower for crisper. */
  var SMOOTH_SIGMA = 1.6;  /* in samples; 1.6 of 384 ≈ 1.5° of arc */
  var SMOOTH_HALF  = Math.max(1, Math.round(SMOOTH_SIGMA * 3));
  var SMOOTH_KERNEL = (function () {
    var out = [], sum = 0, i, v;
    for (i = -SMOOTH_HALF; i <= SMOOTH_HALF; i++) {
      v = Math.exp(-(i * i) / (2 * SMOOTH_SIGMA * SMOOTH_SIGMA));
      out.push(v); sum += v;
    }
    for (i = 0; i < out.length; i++) out[i] /= sum;
    return out;
  }());

  /* ==================================================================
     BLOBLETS — bloblets that break off during a morph
     Where a real liquid changes shape fast, the parts of the surface that
     RETRACT leave mass behind: the bulk pulls away and surface tension
     rounds off what's stranded. So bloblets aren't scattered at random —
     spawnBloblets compares the outgoing and incoming profiles and detaches
     bloblets only at the angles where the outline is receding, weighted by
     how far it recedes there. A pencil pulling in from a fat blob sheds
     along its flanks; a bubble growing wide sheds off its top and bottom.

     They're appended as extra subpaths on the SAME Path2D as the parent and
     filled in the same single gradient pass, so a bloblet is exactly the
     same material as the blob it came from — no second paint, no colour
     mismatch, and it costs one clip instead of one per bloblet.

     LIFECYCLE — water on glass, not water in the air.
     A bloblet does not arc away and evaporate. It separates, sits still,
     and is then drawn back in and swallowed by the next morph:
       detach  the parent's edge recedes past it (barely any velocity of its
               own — the separation comes from the BODY retreating, which is
               what it looks like on a pane of glass)
       rest    it sits, essentially static, for the whole dwell
       absorb  the next morph begins and it is pulled back toward the body
     Absorption needs no crossfade at all: because bloblets are subpaths on
     the same union-clipped path, the moment one overlaps the parent the two
     simply read as a single shape. It is consumed, not faded.
     ================================================================== */
  var BLOBLETS_ON  = true;
  var BLOBLET_MIN  = 1, BLOBLET_MAX = 1;   /* per morph */
  /* Hard ceiling on bloblets VISIBLE at once. Holding to 1 needs one extra
     trick: a morph absorbs the old bloblet and sheds a new one at the same
     moment, which would briefly show 2. So the new one is delayed until
     absorption has finished — still inside the morph, so it detaches while
     the shape is visibly moving. */
  var BLOBLET_CAP  = 1;

  /* Bloblet spacing, all in CSS px, all enforced every frame rather than
     only at spawn — the parent wobbles, breathes and swells continuously, so
     any clearance established once will not hold on its own.
       GAP_MIN  closest a bloblet's edge may come to the blob's outline
       GAP_MAX  furthest it may drift; past this it is drawn back in so the
                bloblets stay a group rather than scattering
       SEP      clear space between two bloblets, so they never overlap */
  /* Pulled in from 12/24/15. This is the lever that removes the movement on
     reclaim, and it is worth knowing why: the bloblet has to be somewhere
     the returning blob can cover WITHOUT it travelling, and the blob's
     radius at any one angle dips ~15% below nominal at the wobble trough.
     Resting 15px clear put it outside that dip, so it had to move 3–13px
     inward to be reabsorbed. Resting ~10px clear puts it inside, and the
     reclaim becomes pure blob growth. */
  var BLOBLET_GAP_MIN_PX  = 9;
  var BLOBLET_GAP_MAX_PX  = 22;
  /* Where detaching aims for, inside the band. Pulled in from 18px for v4:
     the bloblet has to end up somewhere the returning blob can actually
     reach out over, or engulfment never completes and it falls back to
     travelling in — which is the look v4 exists to get rid of. */
  var BLOBLET_GAP_REST_PX = 15;
  var BLOBLET_SEP_PX      = 10;
  /* Preferred size range. The actual size is whatever the room at the shed
     angle allows, capped by this — see spawnBloblets. */
  var BLOBLET_SIZE_MIN    = 0.105;   /* ~13px diameter */
  var BLOBLET_SIZE_MAX    = 0.175;   /* ~21px diameter */
  /* How far out the returning blob can be relied on to reach. Nominal radius
     is 1.0; the ripple dips it ~13% at the trough, and it is the trough that
     has to do the covering — but RECLAIM_SWELL below adds it back and more
     for the duration of an inbound morph, so the usable reach is ~0.95.
     This number sets how far out a bloblet may rest: too small and the
     bloblet has to be crowded up against the shape to stay reclaimable,
     which is what made it sit only 5px clear. */
  var BLOB_REACH          = 0.98;
  /* The blob briefly swells as it takes a bloblet back — an inhale. Applied
     only on inbound (→ blob) morphs and driven by the same mid-morph energy
     curve as everything else, so it is one motion, not a second one. It is
     what buys the bloblet room to rest further out without having to travel
     inward to be reabsorbed. */
  var RECLAIM_SWELL       = 0.15;
  var reclaimSwell        = 0;
  /* the same four in profile units (radius fractions); set in mount() */
  var gapMin = 0.20, gapMax = 0.40, gapRest = 0.30, sepMin = 0.17;
  /* Still held round by surface tension, but no longer a near-perfect
     circle — enough ripple to read as a piece of the same organic material
     the blob is made of, well short of the parent's full wobble. */
  var BLOBLET_RIPPLE = 0.058, BLOBLET_RIPPLE2 = 0.036;
  var bloblets = [];
  var lastTilt = 0;                        /* tilt at the last drawn frame */
  var lastBox = [1, 1];                    /* blob's box at the last drawn frame */

  function rnd(a, b) { return a + Math.random() * (b - a); }

  /* Half-extents of the axis-aligned box around the blob's current outline.
     The bloblet is confined inside this box (see stepBloblets), which ties
     it to the shape's own footprint instead of letting it sit wherever a
     fixed pixel distance happens to put it. The corners of the box are the
     natural place for it: empty for a diagonal pencil or a wide bubble, so
     the bloblet can be clear of the outline and inside the box at once. */
  /* Distance from the centre out to the box boundary along one direction.
     The box is enforced through this — by capping where the bloblet is
     ever ASKED to go — rather than by clamping its position afterwards.
     A post-hoc clamp had to rewrite the angle when it engaged, which
     teleported the bloblet: measured, it produced 1600 px/s spikes and
     fought the very smoothness this version is about. A target the bloblet
     eases toward keeps the motion continuous and the box is still never
     crossed, because it is never aimed past it. */
  function boxLimit(a, hx, hy) {
    var ca = Math.abs(Math.cos(a)), sa = Math.abs(Math.sin(a));
    var lx = ca > 1e-6 ? hx / ca : Infinity;
    var ly = sa > 1e-6 ? hy / sa : Infinity;
    return Math.min(lx, ly);
  }

  function outlineBox(t, st) {
    var hx = 0, hy = 0, i, a, r;
    for (i = 0; i < 64; i++) {
      a = (i / 64) * TAU;
      r = radiusAt(a, t, st);
      hx = Math.max(hx, Math.abs(Math.cos(a) * r));
      hy = Math.max(hy, Math.abs(Math.sin(a) * r));
    }
    return [hx, hy];
  }

  /* The blob's box under no wobble — a stable reference for spawn-time
     feasibility checks, which run outside the draw loop. */
  var homeHx = 1.0, homeHy = 1.0;

  function spawnBloblets(fromShape, toShape, tilt) {
    if (!BLOBLETS_ON) return;
    var K = 64, cands = [], total = 0, i, a, recede;
    for (i = 0; i < K; i++) {
      a = (i / K) * TAU;
      /* positive = the outline is pulling inward at this angle */
      recede = fromShape.profile(a - tilt) - toShape.profile(a - tilt);
      if (recede > 0.12) { cands.push([a, recede]); total += recede; }
    }
    if (!cands.length) return;   /* nothing retracts — nothing to shed */

    /* If a previous pair is still being reclaimed, hold the new pair back
       until that has finished — this is what keeps the visible count at 2. */
    var absorbing = false;
    for (i = 0; i < bloblets.length; i++) {
      var m = bloblets[i].mode;
      if (m === 'absorb' || m === 'engulf') { absorbing = true; break; }
    }
    /* Reclaiming now runs on the morph's clock, so the wait is expressed in
       the same terms: hold the new bloblet back for most of the morph the
       old one is being taken back in. */
    var holdOff = absorbing ? morphDur * 0.55 : 0;

    var want = Math.round(rnd(BLOBLET_MIN, BLOBLET_MAX)), made = 0, tries = 0;
    while (made < want && tries < 40) {
      tries++;
      /* pick an angle weighted by how much the edge recedes there */
      var pick = Math.random() * total, acc = 0, c = cands[cands.length - 1], j;
      for (j = 0; j < cands.length; j++) {
        acc += cands[j][1];
        if (acc >= pick) { c = cands[j]; break; }
      }
      var ang = c[0] + rnd(-0.13, 0.13);
      var rFrom = fromShape.profile(ang - tilt);
      var rTo   = toShape.profile(ang - tilt);

      /* ---- size the bloblet to the room that exists here ----
         Everything it needs — its own diameter plus a resting gap — has to
         fit between the shape being formed and the reach of the blob that
         will come back for it. A single fixed size could not satisfy both
         shapes: measured, the pencil leaves 32px of radial room and the
         chat bubble only 19px, so a 21–24px bloblet fits the pencil and is
         simply impossible on the bubble. Asking for one fixed size meant
         the bubble beat shed nothing at all.
         So the size is whatever the room allows, up to the preferred
         maximum: ~21–24px off the pencil, ~14px off the bubble. */
      var room  = BLOB_REACH - rTo;
      var maxSz = (room - gapMin) / 2;
      if (maxSz < BLOBLET_SIZE_MIN) continue;    /* genuinely no space here */
      /* Biased toward the top of the range (sqrt skews the draw upward) so
         that where there IS room the bloblet actually uses it — a flat draw
         gave the pencil a 13px bloblet about as often as a 23px one, even
         though it had room for the larger. */
      var sz = Math.min(
        BLOBLET_SIZE_MIN + (BLOBLET_SIZE_MAX - BLOBLET_SIZE_MIN) * Math.sqrt(Math.random()),
        maxSz);
      /* and its resting gap is whatever is left over, never below the min */
      var restGap = Math.max(gapMin, Math.min(gapRest, room - 2 * sz));
      /* The outline has to pull back by at least the bloblet's own radius
         for shedding there to read as leaving something behind. The old test
         also tried to reserve the full clearance up front, which was too
         strict — pencil → bubble has only ~0.34 to work with and shed on
         barely 40% of loops. It no longer needs to: the bloblet now travels
         outward under its own steam and the band clamp guarantees the gap. */
      if (rFrom - rTo < sz) continue;
      /* And there has to be somewhere legal for it to end up: inside the
         blob's box AND clear of the shape it is leaving. Checking this at
         spawn is what keeps the two rules from ever fighting later — pick a
         viable angle now and no correction is needed afterwards. The
         diagonals win most often, since that is where the box corner is
         furthest from the outline. */
      if (boxLimit(ang, homeHx, homeHy) - sz < rTo + sz + gapMin) continue;
      bloblets.push({
        a:     ang,
        r:     rFrom,                   /* replaced on emergence, see below */
        vr:    rnd(0.00002, 0.00008),   /* outward, fraction of r0 per ms */
        vt:    rnd(-0.00004, 0.00004),  /* tangential drift               */
        size:  sz,
        restGap: restGap,
        t:     0,
        /* Queued, not yet visible. It waits out the previous bloblet's
           absorption, then emerges from the outline as it stands at that
           moment — see the 'pending' branch in stepBloblets. */
        mode:  'pending',
        absorbT: 0,
        uStart: 0,
        /* Small, so the bloblet starts moving with the morph rather than
           after it. Its travel is measured over whatever is left of the
           morph either way, but the closer to zero the more the two read
           as a single event. */
        delay: holdOff + rnd(0, 60),
        phase: rnd(0, TAU)
      });
      made++;
      while (bloblets.length > BLOBLET_CAP) bloblets.shift();
    }
  }

  /* Marks every settled bloblet for absorption. Called when a new morph
     starts, so the body reclaims what it shed on the way into this shape. */
  /* Breaking away and being reclaimed are the same journey in reverse, so
     they take the same time and the same easing. Both have to finish inside
     the morph window, since the next bloblet cannot appear until the
     previous one is gone (BLOBLET_CAP). */
  /* Detaching has no duration of its own any more — it is driven by the
     morph's progress so the two are one motion. Only the fallback path,
     where the bloblet has to travel in under its own steam, still needs a
     timer. */


  /* Called when a new morph starts, to decide how the body takes its bloblet
     back. Two ways, and which one applies is a question about the incoming
     shape, not a style choice:
       ENGULF  the incoming outline will reach out past the bloblet anyway,
               so let it. The bloblet holds still and the blob grows over it.
               All the motion belongs to the body — this is what stops it
               looking like the bloblet "moves out of the blob and back into
               it". Under v4's blob-as-home structure every inbound morph is
               an expansion, so this is the normal path.
       ABSORB  the incoming shape is too small to ever reach it (a bloblet
               stranded next to the thin pencil), so it has to travel in
               itself. Now only a fallback. */
  function reclaimBloblets(toShape, tilt, uNow) {
    for (var i = bloblets.length - 1; i >= 0; i--) {
      var b = bloblets[i];
      /* one that has not appeared yet simply never does */
      if (b.mode === 'pending') { bloblets.splice(i, 1); continue; }
      if (b.mode !== 'free' && b.mode !== 'detach') continue;
      /* One path now. There used to be a choice here — let the blob engulf
         the bloblet, or have the bloblet travel in — decided by comparing
         the incoming shape's radius against it. That decision was fragile
         (it read the bare profile, ignoring the ~15% the wobble adds, and
         mis-routed about half) and the travel-in branch is what carried the
         fade. stepBloblets now covers both behaviours continuously: hold
         still while the blob can reach, close the remainder when it can't. */
      b.mode = 'engulf';
      b.engulfT = 0;
      b.uStart = uNow;
    }
  }

  function stepBloblets(dt, st, t) {
    /* The box is the BLOB's, not the current shape's.
       The current shape is the more literal reading of the rule but it is
       provably unsatisfiable: measured, the chat bubble very nearly fills
       its own bounding box, so at EVERY angle there is no position both
       inside that box and the required 12px clear of the outline. The
       blob's box is the footprint the whole animation occupies, which is
       the constraint that actually does the useful work — it stops the
       bloblet drifting outside the composition. */
    var blobSt = { from: SHAPES.blob, to: SHAPES.blob, u: 1,
                   wobbleAmt: st.wobbleAmt, pulse: st.pulse,
                   tilt: st.tilt, flatten: 1 };
    var box = outlineBox(t, blobSt), hx = box[0], hy = box[1];
    lastBox = box;
    for (var i = bloblets.length - 1; i >= 0; i--) {
      var b = bloblets[i];

      if (b.mode === 'pending') {
        b.delay -= dt;
        if (b.delay > 0) continue;
        /* Emerge from the outline WHERE IT IS NOW, not where it was when
           this bloblet was queued. It waits out the previous bloblet's
           absorption first, by which point the blob has retracted a long
           way — starting from the old edge would drop it into empty space
           and it would then travel outward from there, which is not
           breaking off anything. */
        /* Emerge from inside the mass, and never further out than the box —
           starting exactly on the rim put the bloblet's far side outside the
           box for the first few frames (measured, ~7px). Being born a little
           deeper also reads better: it comes out of the body rather than off
           the edge of it. */
        b.r = Math.min(radiusAt(b.a, t, st) * 0.95,
                       boxLimit(b.a, hx, hy) - b.size);
        b.rStart = b.r;
        /* Remember how far through the morph we already are, so the detach
           can be measured over what REMAINS of it. Without this a bloblet
           that was held back (waiting out a previous one) would inherit a
           progress of, say, 0.6 and jump 60% of the way to its rest
           position on its very first frame. */
        b.uStart = st.u;
        b.mode = 'detach';
        b.t = 0;
      }

      b.t += dt;

      /* where the parent's outline currently sits at this bloblet's angle */
      var parentR = radiusAt(b.a, t, st);

      if (b.mode === 'detach') {
        /* Driven by the MORPH's own progress, not a timer of its own.
           This is the fix for the bloblet and the blob feeling like two
           separate events: they were on different clocks (420ms against
           850ms), so the bloblet finished its move less than two thirds of
           the way through the morph and then just sat there. Sharing the
           morph's eased progress means one motion, one curve, and the
           separation is complete at exactly the moment the shape lands. */
        var pd = Math.min(1, (st.u - b.uStart) / Math.max(0.02, 1 - b.uStart));
        /* target capped by the box, so the journey ends inside it */
        var restR = Math.min(parentR + b.size + b.restGap,
                             boxLimit(b.a, hx, hy) - b.size);
        b.r = b.rStart + (restR - b.rStart) * pd;
        b.gapPx = b.r - b.size - parentR;
        /* necked while it pulls away, round once free */
        b.stretch = 1 + 0.30 * (1 - pd);
        b.sizeMul = 1;
        if (pd >= 0.999) b.mode = 'free';

      } else if (b.mode === 'engulf') {
        /* ONE reclaim path, no fade anywhere in it.
           Mostly the blob does the work: it grows back out and covers the
           bloblet, which holds still. But the blob cannot always reach —
           measured against the chat bubble, full coverage would need a
           NEGATIVE resting gap, so it is arithmetically impossible there.
           So once the morph is past halfway the bloblet closes whatever
           remains itself, gently. For the pencil that remainder is nil and
           it never moves; for the bubble it is ~15px against the blob's own
           ~23px of growth, so the body still does most of it.
           Previously this was two modes with a fade in the fallback, and
           the fallback fired on 13 bloblets in 18 — which is precisely the
           "fades without moving" you were seeing. */
        b.r  += b.vr * dt;
        b.vr -= b.vr * dt * 0.006;
        b.stretch = 1;
        b.sizeMul = 1;
        b.engulfT += dt;

        var pr = Math.min(1, (st.u - b.uStart) / Math.max(0.02, 1 - b.uStart));
        if (pr > 0.45) {
          /* A last nudge, and normally not even that. spawnBloblets only
             sheds where the returning blob will already contain the resting
             bloblet, so `need` is usually further out than b.r and this does
             nothing at all — the reclaim is pure blob growth.
             It exists for the wobble trough: the blob's radius at any one
             angle swings ±15%, so on an unlucky phase it falls a couple of
             px short of covering. Aiming 1.04 of its own radius inside is
             just past the removal test below, which is what makes the test
             reachable without the bloblet travelling to meet it.
             The previous 1.15, fully converged, is what put the movement
             back in. */
          var g = smootherstep((pr - 0.45) / 0.55);
          var need = parentR - b.size * 1.04;
          if (need < b.r) b.r += (need - b.r) * g;
        }
        /* the box applies here too — its own faint drift is outward, and
           without this it crept past the boundary by a few px */
        var capE = boxLimit(b.a, hx, hy) - b.size;
        if (b.r > capE) b.r = capE;
        b.gapPx = b.r - b.size - parentR;

        /* Gone only once it is ENTIRELY inside the outline. This used to
           fire at 0.85 of its radius, so it was removed with a sliver still
           poking out — both a small pop and the edge you could see hanging
           over the blob's own. */
        if (parentR >= b.r + b.size) { bloblets.splice(i, 1); continue; }

      } else {                      /* free — resting on the glass */
        b.sizeMul = 1;
        b.stretch = 1;
        b.r  += b.vr * dt;
        b.a  += b.vt * dt;
        b.vr -= b.vr * dt * 0.006;     /* creeps, then stops */

        /* Keep the bloblet inside a band around the outline. Both edges are
           hard clamps rather than eased: easing toward the near edge let a
           fast-morphing outline outrun the correction and genuinely overlap
           the bloblet for a few frames. Clamping looks identical anyway,
           because the outline itself moves smoothly so the per-frame
           correction is tiny — the only real jump is at spawn, hidden under
           the bloblet's 90ms grow-in.
           The far edge is what stops bloblets stranding out in space when
           the body retracts hard (blob → pencil pulls the outline in by
           more than half a radius); they now follow it in and stay a
           group. */
        /* A slow drift back toward the resting gap. Without it the bloblet
           ends up pinned against whichever clamp the blob's breathing
           happens to press it into — measured, it sat at exactly gapMin for
           almost the entire dwell. This is deliberately far slower than the
           clamps (~900ms) so it recentres over the dwell without fighting
           the wobble frame to frame. */
        /* Every target and limit here is capped by the box as well, so the
           bloblet is never asked to sit outside it and never has to be
           yanked back. */
        var cap = boxLimit(b.a, hx, hy) - b.size;
        var restR = Math.min(parentR + b.size + b.restGap, cap);
        b.r += (restR - b.r) * Math.min(1, dt / 900);

        var minR = parentR + b.size + gapMin;
        var maxR = Math.min(parentR + b.size + gapMax, cap);
        /* If the box is tighter than the minimum clearance there is no legal
           spot; never overlap the blob, so the gap wins and the box gives. */
        if (maxR < minR) maxR = minR;
        if (b.r < minR)      b.r = minR;
        else if (b.r > maxR) b.r = maxR;

        b.gapPx = b.r - b.size - parentR;    /* profile units, for probing */
      }

    }
  }

  /* Keeps bloblets from overlapping each other.
     Spreads them apart in ANGLE only, never in radius — a radial push would
     immediately be undone by the [gapMin, gapMax] clamp above, so the two
     rules would fight and neither would hold. Sliding them around the blob
     instead satisfies both at once. */
  function separateBloblets() {
    for (var i = 0; i < bloblets.length; i++) {
      for (var j = i + 1; j < bloblets.length; j++) {
        var A = bloblets[i], B = bloblets[j];
        if (A.mode === 'pending' || B.mode === 'pending') continue;
        var ax = Math.cos(A.a) * A.r, ay = Math.sin(A.a) * A.r;
        var bx = Math.cos(B.a) * B.r, by = Math.sin(B.a) * B.r;
        var dx = bx - ax, dy = by - ay;
        var d = Math.sqrt(dx * dx + dy * dy);
        var need = A.size + B.size + sepMin;
        if (d >= need) continue;
        /* the angle that chord subtends at their mean radius */
        var rAvg = Math.max(0.2, (A.r + B.r) / 2);
        var needAng = 2 * Math.asin(Math.min(1, need / (2 * rAvg)));
        var delta = angDist(B.a, A.a);
        var sign = delta >= 0 ? 1 : -1;
        var mid = A.a + delta / 2;
        A.a = mid - sign * needAng / 2;
        B.a = mid + sign * needAng / 2;
      }
    }
  }

  /* Appends each live bloblet to `path` as its own closed subpath. */
  function addBloblets(path, cx, cy, r0, ts) {
    var STEPSB = 40, i, k, b, pts, aa, rr;
    for (k = 0; k < bloblets.length; k++) {
      b = bloblets[k];
      if (b.mode === 'pending') continue;
      /* Size is constant while the bloblet is free — it is reclaimed by the
         body, not shrunk out of existence in open space. sizeMul only comes
         off 1 during the back half of absorption, hidden inside the blob. */
      var grow = Math.min(1, b.t / 90);        /* separates over ~90ms */
      var sz = b.size * grow * (b.sizeMul === undefined ? 1 : b.sizeMul) * r0;
      if (sz <= 0.3) continue;
      var px = cx + Math.cos(b.a) * b.r * r0;
      var py = cy + Math.sin(b.a) * b.r * r0;
      /* Surface tension. A separating bloblet necks while it pulls away and
         snaps round once free; being drawn back in stretches it again. Both
         are driven by the phase progress in stepBloblets. Kept subtle — the
         target is "almost a perfect circle", so this reads as tension rather
         than as a smear. Squash across by the square root of the stretch so
         the area stays constant and it doesn't appear to swell. */
      var stretch = b.stretch === undefined ? 1 : b.stretch;
      var across  = 1 / Math.sqrt(stretch);
      var ca = Math.cos(b.a), sa = Math.sin(b.a);
      pts = [];
      for (i = 0; i < STEPSB; i++) {
        aa = (i / STEPSB) * TAU;
        /* Only a whisper of the parent's ripple. A water drop is held round
           by surface tension; the parent's full organic wobble at this
           scale was the "too much detail" problem. */
        rr = sz * (1 + BLOBLET_RIPPLE  * Math.sin(2 * aa + b.phase + ts * 0.0012)
                     + BLOBLET_RIPPLE2 * Math.cos(3 * aa - b.phase));
        /* build it in the bloblet's own frame (x = radially outward), then
           rotate that frame onto b.a */
        var lx = Math.cos(aa) * rr * stretch,
            ly = Math.sin(aa) * rr * across;
        pts.push([px + lx * ca - ly * sa, py + lx * sa + ly * ca]);
      }
      path.moveTo((pts[0][0] + pts[STEPSB-1][0]) / 2,
                  (pts[0][1] + pts[STEPSB-1][1]) / 2);
      for (i = 0; i < STEPSB; i++) {
        var c1 = pts[i], n1 = pts[(i + 1) % STEPSB];
        path.quadraticCurveTo(c1[0], c1[1], (c1[0]+n1[0])/2, (c1[1]+n1[1])/2);
      }
      path.closePath();
    }
  }

  /* Returns the radius multiplier at angle `a` for the current morph state. */
  function radiusAt(a, t, st) {
    /* The wobble is two layers.
       RIPPLE is the original t-avatar wobble, verbatim: an angular ripple.
       It is precisely what gives the blob its character — but on a shape
       that already has a silhouette of its own it reads as lumpiness (the
       bubble grew lobes and looked like a brain), so each shape scales it
       down via `wobble`.
       BREATH is angle-independent, so it cannot distort a silhouette and
       runs at full strength on every shape. That is what keeps the pencil
       and the bubble visibly alive rather than frozen. */
    var ripple = 0.10 * Math.sin(2*a + t*1.4) + 0.07 * Math.cos(3*a - t*1.0);
    var breath = 0.055 * Math.sin(t * 1.15);
    var wob = st.wobbleAmt * ripple + breath;
    var ang = a - st.tilt;
    var rA  = st.from.profile(ang);
    var rB  = st.to.profile(ang);
    var r   = rA + (rB - rA) * st.u;
    /* `flatten` pulls the silhouette back towards a circle. 1 = the true
       shape; the glow uses a lower value so that when the blob becomes a
       thin pencil the bloom still reads as a bloom rather than a knife
       edge — it leans in the same direction, just far less committed. */
    if (st.flatten !== 1) r = 1 + (r - 1) * st.flatten;
    return r * (1 + wob) * st.pulse;
  }

  function makeShapePath(cx, cy, r0, t, st) {
    var i, j, a;

    /* 1. sample the raw radius profile */
    var raw = new Array(STEPS);
    for (i = 0; i < STEPS; i++) raw[i] = radiusAt((i / STEPS) * TAU, t, st);

    /* 2. circular low-pass — this is what keeps points from going sharp */
    var pts = [], acc;
    for (i = 0; i < STEPS; i++) {
      acc = 0;
      for (j = -SMOOTH_HALF; j <= SMOOTH_HALF; j++) {
        acc += raw[(i + j + STEPS) % STEPS] * SMOOTH_KERNEL[j + SMOOTH_HALF];
      }
      a = (i / STEPS) * TAU;
      pts.push([cx + Math.cos(a) * r0 * acc, cy + Math.sin(a) * r0 * acc]);
    }
    /* same midpoint-quadratic smoothing as the original component */
    var path = new Path2D();
    path.moveTo((pts[0][0] + pts[STEPS-1][0]) / 2, (pts[0][1] + pts[STEPS-1][1]) / 2);
    for (i = 0; i < STEPS; i++) {
      var c = pts[i], n = pts[(i+1) % STEPS];
      path.quadraticCurveTo(c[0], c[1], (c[0]+n[0])/2, (c[1]+n[1])/2);
    }
    path.closePath();
    return path;
  }

  /* ---------- instance state ---------- */
  var canvas = null, ctx = null, W = 0, H = 0;
  var glowCanvas = null, glowCtx = null, GW = 0, GH = 0, glowHost = null;
  var asGlow = false;

  var fromP = EMBER, toP = EMBER, fadeT = 1, fadeDur = 800;
  var orbit = 0, lastTs = 0, rafId = null;

  /* morph state */
  var fromS = SHAPES.blob, toS = SHAPES.blob;
  var morphT = 1, morphDur = 1100, morphDir = 1;
  var tiltBase = 0;

  function draw(ts) {
    if (!canvas || !ctx) return;

    var dt = Math.min(ts - lastTs, 50);
    lastTs = ts;

    /* ---- gradient drift + colour crossfade ----
       `orbit` drives two things at once: the gradient spots travelling
       around the inside of the silhouette, and the phase of the wobble.
       ~10s per revolution — fast enough to read as continuous motion
       during a 2.2s caption, slow enough to stay calm. */
    orbit += dt * 0.00065;
    if (fadeT < 1) fadeT = Math.min(1, fadeT + dt / fadeDur);
    var p = fadeT >= 1 ? toP : lerpPreset(fromP, toP, fadeT);
    if (fadeT >= 1) fromP = toP;

    /* ---- morph progress ---- */
    if (morphT < 1) morphT = Math.min(1, morphT + dt / morphDur);
    var raw = morphT;
    /* overshoot on the way in, so the silhouette springs past its target
       and settles — this is most of the "dramatic" */
    var u = raw >= 1 ? 1 : smootherstep(raw);
    /* A gentle swell across the middle of the morph. Deliberately small:
       these are a SECOND motion superimposed on the first, and at the old
       amplitudes (0.25 / 0.12 / 0.26) the blob visibly grew and tilted
       part-way through, which added to the two-step reading. Now barely
       more than a breath. */
    var energy = raw >= 1 ? 0 : Math.sin(Math.PI * raw);
    energy = energy * energy * (3 - 2 * energy); /* smoothstep, softer peak */

    /* Wobble runs at full strength on every shape, all the time; the morph
       only briefly amplifies it. */
    var wobbleAmt = (fromS.wobble + (toS.wobble - fromS.wobble) * u)
                    * (1 + 0.10 * energy);
    var st = {
      from: fromS, to: toS, u: u,
      wobbleAmt: wobbleAmt,
      pulse: 1 + (0.035 + reclaimSwell) * energy - 0.02 * Math.sin(ts * 0.0011),
      tilt: tiltBase + 0.10 * Math.sin(ts * 0.00042) + morphDir * 0.09 * energy,
      flatten: 1
    };
    if (raw >= 1) fromS = toS;
    lastTilt = st.tilt;          /* spawnBloblets needs the current tilt */
    if (asGlow) {                /* an independent glow: the same shape and gradient, flattened, drawn straight onto the canvas */
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      ctx.clip(makeShapePath(W/2, H/2, W * 0.30, orbit, {
        from: st.from, to: st.to, u: st.u, tilt: st.tilt, pulse: st.pulse,
        wobbleAmt: st.wobbleAmt * 0.6, flatten: GLOW_FLATTEN }));
      paintGradient(ctx, p, W, H, orbit);
      ctx.restore();
      return;
    }
    stepBloblets(dt, st, orbit); /* absorption tracks the live outline */
    separateBloblets();          /* then de-overlap, angularly */

    /* ---- breathing bounce (unchanged) ---- */
    var bounceY = Math.sin(ts * 0.0008) * 6;
    canvas.style.transform = 'translateY(' + bounceY.toFixed(2) + 'px)';
    /* the glow only gets a custom property — its layout stays in CSS */
    if (glowHost) glowHost.style.setProperty('--bounce', (bounceY * 1.8).toFixed(2) + 'px');

    /* ---- the blob ---- */
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    /* The blob and every live bloblet go on ONE path — separate closed
       subpaths clip as a union — so a single gradient pass fills them all
       and a bloblet is literally the same material as its parent. */
    var bodyPath = makeShapePath(W/2, H/2, W * 0.288, orbit, st);
    addBloblets(bodyPath, W/2, H/2, W * 0.288, ts);
    ctx.clip(bodyPath);
    paintGradient(ctx, p, W, H, orbit);
    ctx.restore();

    /* ---- the glow: same shape, same gradient, bigger, then CSS-blurred ---- */
    if (glowCanvas && glowCtx) {
      var gst = {
        from: st.from, to: st.to, u: st.u, tilt: st.tilt, pulse: st.pulse,
        wobbleAmt: st.wobbleAmt * 0.6,  /* the blur eats fine wobble anyway */
        flatten: GLOW_FLATTEN
      };
      glowCtx.clearRect(0, 0, GW, GH);
      glowCtx.save();
      glowCtx.clip(makeShapePath(GW/2, GH/2, GW * 0.30, orbit, gst));
      paintGradient(glowCtx, p, GW, GH, orbit);
      glowCtx.restore();
    }
  }

  return {
    COOL: COOL, WARM: WARM, ROSE: ROSE, EMBER: EMBER, BLOOM: BLOOM,
    SHAPES: SHAPES,

    /* mount(blobCanvas, { glow: glowCanvas })
       `glow` is optional. Unlike the old component this does NOT inject an
       element into the DOM or fight with containing blocks: you place the
       glow canvas wherever you want and hand it over. */
    mount: function (el, opts) {
      opts = opts || {};
      canvas = el;
      asGlow = !!opts.asGlow;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var sz  = el.offsetWidth || el.clientWidth || 58;
      W = H = asGlow ? Math.max(96, Math.round(sz * 0.32)) : Math.round(sz * dpr);   /* a glow is blurred to oblivion: draw it small */
      canvas.width = canvas.height = W;
      ctx = canvas.getContext('2d');

      /* Convert the bloblet distances from CSS px into the profile units the
         bloblet code works in. r0 is W * 0.288 device px, so dividing by it
         makes them independent of both DPR and the blob's size — set
         --t-blob-size to anything and 12px still means 12px. */
      var toProfile = dpr / (W * 0.288);
      gapMin  = BLOBLET_GAP_MIN_PX  * toProfile;
      gapMax  = BLOBLET_GAP_MAX_PX  * toProfile;
      /* gapRest was missing from this list, so it silently kept its
         initialiser (0.30 ≈ 18px) and BLOBLET_GAP_REST_PX did nothing at
         all. That is why the bloblet rested ~18px out however the constant
         was set — and why it then had to travel to be reabsorbed. */
      gapRest = BLOBLET_GAP_REST_PX * toProfile;
      sepMin  = BLOBLET_SEP_PX      * toProfile;

      if (opts.glow) {
        glowCanvas = opts.glow;
        glowHost = opts.glowHost || glowCanvas.parentElement;
        var gsz = glowCanvas.offsetWidth || 480;
        /* the glow is blurred to oblivion anyway — render it at a low
           resolution and let the blur hide it. Cheap, and identical output. */
        GW = GH = Math.max(96, Math.round(gsz * 0.32));
        glowCanvas.width = glowCanvas.height = GW;
        glowCtx = glowCanvas.getContext('2d');
      }

      lastTs = 0;   /* the host calls frame(ts); the engine never schedules itself */
      return this;
    },

    /* setShape('pencil', 460) */
    setShape: function (name, duration) {
      var next = typeof name === 'string' ? SHAPES[name] : name;
      if (!next || next === toS) return this;
      /* if a morph is still running, freeze the current silhouette as the
         new origin so back-to-back calls never snap */
      if (morphT < 1) {
        /* Must use the SAME curve the draw loop uses, or the frozen
           silhouette won't match what is on screen and an interrupted morph
           will jump. It previously called the composed easing with k=1.15
           while draw() used 0.75 — a mismatch that would have shown as a
           snap the first time a morph was interrupted mid-flight. */
        var u = smootherstep(morphT);
        var a1 = fromS, b1 = toS, uu = u;
        fromS = { label:'(mid)', wobble: a1.wobble + (b1.wobble-a1.wobble)*uu,
                  profile: function (a) {
                    var ra = a1.profile(a), rb = b1.profile(a);
                    return ra + (rb - ra) * uu;
                  } };
      }
      var prev = fromS;
      toS = next;
      morphDur = (duration === undefined) ? 1100 : duration;
      morphDir = -morphDir;
      if (morphDur === 0) {
        morphT = 1; fromS = next;   /* instant set — nothing detaches */
      } else {
        morphT = 0;
        /* Swell only when coming home to the blob — that is the morph that
           has to reach out and gather the bloblet back. */
        reclaimSwell = (next === SHAPES.blob) ? RECLAIM_SWELL : 0;
        /* Reclaim last beat's bloblet, then shed this beat's. Order
           matters: reclaimBloblets only touches 'free'/'detach' ones, so
           the new arrival isn't immediately swallowed. */
        reclaimBloblets(next, lastTilt, morphT >= 1 ? 0 : smootherstep(morphT));
        spawnBloblets(prev, next, lastTilt);
      }
      return this;
    },

    /* setPreset(TBlob.EMBER, 1200) — unchanged semantics */
    setPreset: function (preset, duration) {
      fromP = fadeT < 1 ? lerpPreset(fromP, toP, fadeT) : toP;
      toP = preset;
      if (duration === 0) { fadeT = 1; fromP = preset; }
      else { fadeT = 0; fadeDur = (duration === undefined) ? 800 : duration; }
      return this;
    },

    currentShape: function () { return toS.label; },

    /* setBloblets(false) turns the bloblets off; setBloblets(true, 1, 2)
       also sets how many detach per morph. Raising max above BLOBLET_CAP
       will not put more than the cap on screen at once. */
    setBloblets: function (on, min, max) {
      BLOBLETS_ON = !!on;
      if (min !== undefined) BLOBLET_MIN = min;
      if (max !== undefined) BLOBLET_MAX = max;
      if (!BLOBLETS_ON) bloblets.length = 0;
      return this;
    },
    /* Bloblet spacing in CSS px: nearest and furthest a bloblet may sit
       from the blob's outline, and the clear space between two bloblets.
       setBlobletSpacing(12, 24, 10) restores the defaults. */
    setBlobletSpacing: function (minPx, maxPx, sepPx, restPx) {
      if (minPx  !== undefined) BLOBLET_GAP_MIN_PX  = minPx;
      if (maxPx  !== undefined) BLOBLET_GAP_MAX_PX  = maxPx;
      if (sepPx  !== undefined) BLOBLET_SEP_PX      = sepPx;
      if (restPx !== undefined) BLOBLET_GAP_REST_PX = restPx;
      if (W) {
        var tp = Math.min(window.devicePixelRatio || 1, 2) / (W * 0.288);
        gapMin  = BLOBLET_GAP_MIN_PX  * tp;
        gapMax  = BLOBLET_GAP_MAX_PX  * tp;
        gapRest = BLOBLET_GAP_REST_PX * tp;
        sepMin  = BLOBLET_SEP_PX      * tp;
      }
      return this;
    },
    liveBloblets: function () { return bloblets.length; },

    /* host controls: one frame, stop drawing, and what a second engine needs to take over smoothly */
    frame: draw,
    unmount: function () { canvas = ctx = glowCanvas = glowCtx = glowHost = null; return this; },
    getOrbit: function () { return orbit; },
    setOrbit: function (v) { orbit = v; return this; },
    getPreset: function () { return fadeT >= 1 ? toP : lerpPreset(fromP, toP, fadeT); },
    isHome: function () { return morphT >= 1 && toS === SHAPES.blob; }
  };
}

/* ================================================================== engine 2: traced outlines (envelope, chat) with a detaching flap and dot */
function createTracedEngine() {

'use strict';
var TAU=Math.PI*2,CX=130,CY=130,R0=75,N=240,M=100,MD=48,K=1.06,SX=107,SY=104;
var DATA={"body":[[105.4,144.4],[103.8,144.5],[102.3,144.6],[100.7,144.7],[99.1,144.8],[97.6,144.9],[96,145],[94.4,145.1],[92.9,145.2],[91.3,145.2],[89.7,145.3],[88.2,145.4],[86.6,145.5],[85,145.6],[83.4,145.7],[81.9,145.8],[80.3,145.9],[78.7,146],[77.2,146.1],[75.6,146.2],[74,146.3],[72.5,146.4],[70.9,146.5],[69.3,146.6],[67.8,146.7],[66.2,146.8],[64.6,146.9],[63.1,147],[61.5,147.1],[59.9,147.2],[58.3,147.3],[56.8,147.4],[55.2,147.3],[53.7,147.1],[52.1,146.7],[50.7,146.1],[49.4,145.3],[48.1,144.3],[47,143.2],[46.1,141.9],[45.4,140.5],[44.8,139.1],[44.4,137.5],[44.3,136],[44.2,134.4],[44.1,132.8],[44,131.3],[43.9,129.7],[43.8,128.1],[43.7,126.6],[43.6,125],[43.5,123.4],[43.4,121.9],[43.3,120.3],[43.2,118.7],[43.1,117.1],[43,115.6],[42.9,114],[42.8,112.4],[42.7,110.9],[42.6,109.3],[42.5,107.7],[42.4,106.2],[42.4,104.6],[42.3,103],[42.2,101.5],[42.1,99.9],[42,98.3],[41.9,96.8],[42,95.2],[42.4,93.7],[42.9,92.2],[43.6,90.8],[44.5,89.5],[45.6,88.4],[46.8,87.4],[48.1,86.5],[49.6,85.9],[51.1,85.4],[52.6,85.2],[54.2,85.1],[55.7,85.3],[57.3,85.7],[58.7,86.3],[60.2,86.9],[61.6,87.6],[63,88.2],[64.5,88.9],[65.9,89.5],[67.3,90.1],[68.8,90.8],[70.2,91.4],[71.6,92.1],[73.1,92.7],[74.5,93.4],[75.9,94],[77.4,94.7],[78.8,95.3],[80.2,96],[81.7,96.6],[83.1,97.3],[84.5,97.9],[86,98.6],[87.4,99.2],[88.8,99.8],[90.2,100.5],[91.7,101.1],[93.1,101.8],[94.5,102.4],[96,103.1],[97.4,103.7],[98.8,104.4],[100.3,105],[101.7,105.6],[103.2,106.1],[104.7,106.4],[106.3,106.5],[107.9,106.4],[109.4,106.1],[110.9,105.5],[112.3,104.8],[113.6,103.9],[114.9,103],[116.1,102.1],[117.4,101.2],[118.7,100.2],[120,99.3],[121.2,98.4],[122.5,97.5],[123.8,96.6],[125.1,95.7],[126.4,94.8],[127.6,93.8],[128.9,92.9],[130.2,92],[131.5,91.1],[132.8,90.2],[134,89.3],[135.3,88.4],[136.6,87.4],[137.9,86.5],[139.1,85.6],[140.4,84.7],[141.7,83.8],[143,82.9],[144.3,82],[145.5,81],[146.8,80.1],[148.1,79.2],[149.4,78.3],[150.7,77.4],[152,76.6],[153.4,75.9],[154.9,75.5],[156.5,75.2],[158,75.2],[159.6,75.4],[161.1,75.8],[162.6,76.4],[164,77.1],[165.2,78.1],[166.3,79.2],[167.3,80.4],[168.1,81.8],[168.7,83.2],[169.1,84.7],[169.3,86.3],[169.4,87.9],[169.5,89.4],[169.5,91],[169.6,92.6],[169.7,94.1],[169.8,95.7],[169.9,97.3],[170,98.9],[170.1,100.4],[170.2,102],[170.3,103.6],[170.4,105.1],[170.5,106.7],[170.6,108.3],[170.7,109.8],[170.8,111.4],[170.9,113],[171,114.5],[171.1,116.1],[171.2,117.7],[171.3,119.2],[171.4,120.8],[171.5,122.4],[171.6,123.9],[171.7,125.5],[171.8,127.1],[171.9,128.7],[171.8,130.2],[171.6,131.8],[171.1,133.3],[170.5,134.7],[169.7,136.1],[168.7,137.3],[167.5,138.3],[166.3,139.3],[164.9,140],[163.4,140.5],[161.9,140.9],[160.3,141],[158.7,141.1],[157.2,141.2],[155.6,141.3],[154,141.4],[152.5,141.5],[150.9,141.6],[149.3,141.7],[147.8,141.8],[146.2,141.9],[144.6,142],[143,142.1],[141.5,142.2],[139.9,142.3],[138.3,142.4],[136.8,142.5],[135.2,142.6],[133.6,142.6],[132.1,142.7],[130.5,142.8],[128.9,142.9],[127.4,143],[125.8,143.1],[124.2,143.2],[122.7,143.3],[121.1,143.4],[119.5,143.5],[118,143.6],[116.4,143.7],[114.8,143.8],[113.2,143.9],[111.7,144],[110.1,144.1],[108.5,144.2],[107,144.3]],"flap":[[102.9,92.8],[101.2,92.7],[99.5,92.4],[97.9,91.9],[96.4,91.2],[94.8,90.6],[93.3,89.9],[91.7,89.3],[90.2,88.6],[88.6,87.9],[87.1,87.3],[85.5,86.6],[84,86],[82.5,85.3],[80.9,84.6],[79.4,84],[77.8,83.3],[76.3,82.7],[74.7,82],[73.2,81.4],[71.6,80.7],[70.1,80],[68.5,79.4],[67,78.7],[65.4,78.1],[63.9,77.4],[62.3,76.7],[60.9,75.9],[59.6,74.7],[58.7,73.4],[58,71.8],[57.6,70.2],[57.6,68.5],[57.9,66.9],[58.5,65.3],[59.5,63.9],[60.6,62.7],[62,61.8],[63.6,61.2],[65.3,60.9],[66.9,60.9],[68.6,60.9],[70.3,60.9],[72,60.9],[73.7,60.9],[75.4,60.9],[77,60.8],[78.7,60.8],[80.4,60.8],[82.1,60.8],[83.8,60.8],[85.5,60.8],[87.1,60.8],[88.8,60.8],[90.5,60.8],[92.2,60.8],[93.9,60.8],[95.5,60.8],[97.2,60.8],[98.9,60.7],[100.6,60.7],[102.3,60.7],[104,60.7],[105.6,60.7],[107.3,60.7],[109,60.7],[110.7,60.7],[112.4,60.7],[114.1,60.7],[115.7,60.7],[117.4,60.8],[119.1,61.2],[120.6,61.8],[122.1,62.6],[123.4,63.6],[124.6,64.8],[125.6,66.2],[126.3,67.7],[126.9,69.3],[127.3,70.9],[127.4,72.6],[127.2,74.3],[126.9,75.9],[126.3,77.5],[125.4,78.9],[124.4,80.2],[123.2,81.4],[121.8,82.4],[120.4,83.3],[119,84.3],[117.6,85.2],[116.2,86.1],[114.8,87],[113.4,88],[112,88.9],[110.6,89.8],[109.2,90.7],[107.7,91.6],[106.2,92.2],[104.5,92.6]],"dot":[[140.1,72.6],[139.3,72.6],[138.6,72.5],[137.8,72.3],[137.1,72],[136.5,71.6],[135.8,71.2],[135.3,70.6],[134.8,70],[134.4,69.3],[134.2,68.6],[134,67.9],[133.9,67.1],[133.9,66.3],[134,65.6],[134.2,64.8],[134.5,64.1],[134.9,63.5],[135.3,62.9],[135.9,62.3],[136.5,61.8],[137.2,61.5],[137.9,61.2],[138.6,61],[139.4,60.9],[140.1,60.9],[140.9,61],[141.7,61.2],[142.4,61.5],[143,61.9],[143.6,62.3],[144.2,62.9],[144.6,63.5],[145,64.2],[145.3,64.9],[145.5,65.6],[145.6,66.4],[145.6,67.2],[145.5,67.9],[145.3,68.7],[145,69.4],[144.6,70],[144.1,70.7],[143.6,71.2],[143,71.7],[142.3,72],[141.6,72.3],[140.9,72.5]]};
function loc(a){return a.map(function(p){return [CX+K*(p[0]-SX),CY+K*(p[1]-SY)]})}
var B=loc(DATA.body),F=loc(DATA.flap),D=loc(DATA.dot);
function cen(P){var x=0,y=0;P.forEach(function(p){x+=p[0];y+=p[1]});return [x/P.length,y/P.length]}
function areaOf(P){var a=0;for(var i=0;i<P.length;i++){var q=P[(i+1)%P.length];a+=P[i][0]*q[1]-q[0]*P[i][1]}return Math.abs(a)/2}
var FC=cen(F),DC=cen(D),FR=Math.sqrt(areaOf(F)/Math.PI),DR=Math.sqrt(areaOf(D)/Math.PI);
function cl(x){return x<0?0:x>1?1:x}
function sm(x){x=cl(x);return x*x*(3-2*x)}
function sm5(p){p=cl(p);return p*p*p*(p*(p*6-15)+10)}
function wrapPi(a){a=a%TAU;if(a>Math.PI)a-=TAU;if(a<-Math.PI)a+=TAU;return a}
function hexRgb(h){return [parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)]}
function lerpColor(a,b,t){var A=hexRgb(a),B2=hexRgb(b);return '#'+[0,1,2].map(function(i){return Math.round(A[i]+(B2[i]-A[i])*t).toString(16).padStart(2,'0')}).join('')}
function lerpPreset(p1,p2,t){return{base:lerpColor(p1.base,p2.base,t),spots:p1.spots.map(function(s,i){var s2=p2.spots[i]||s;return{angle:s.angle+(s2.angle-s.angle)*t,r:s.r+(s2.r-s.r)*t,color:lerpColor(s.color,s2.color,t),opacity:s.opacity+(s2.opacity-s.opacity)*t}})}}
function paintGradient(ctx,p,S,orbit){
  var c=hexRgb(p.base),R=S*0.37;ctx.fillStyle='rgb('+c[0]+','+c[1]+','+c[2]+')';ctx.fillRect(0,0,S,S);
  p.spots.forEach(function(s){var a=s.angle+orbit,sx=S/2+Math.cos(a)*R,sy=S/2+Math.sin(a)*R,k=hexRgb(s.color);
    var g=ctx.createRadialGradient(sx,sy,0,sx,sy,s.r*R);g.addColorStop(0,'rgba('+k+','+s.opacity+')');g.addColorStop(1,'rgba('+k+',0)');ctx.fillStyle=g;ctx.fillRect(0,0,S,S)})
}
/* the envelope's own gradient, taken straight from the SVG (base + 3 elliptical radials) */
var ENV_GRADS=[
 ['245,127,112',[-84.0164,-55.3214,87.5459,-41.8049,172.573,140.256]],
 ['116,52,152',[37.9837,25.6494,-41.7316,20.2127,39.7666,62.4824]],
 ['104,58,148',[-57.105,46.4053,-55.9178,-34.0118,167.315,54.649]]];
var CHATD={"body":[[94.2,132],[92.7,132],[91.3,131.7],[90,131],[88.9,130.3],[87.7,129.4],[86.7,128.4],[85.7,127.4],[84.7,126.3],[83.7,125.3],[82.8,124.2],[81.8,123.1],[80.9,122],[79.9,120.9],[79,119.9],[78,118.8],[77,117.8],[76,116.7],[75,115.7],[73.9,114.8],[72.8,113.9],[71.7,113],[70.4,112.2],[69.2,111.5],[67.9,110.9],[66.5,110.4],[65.2,109.9],[63.8,109.5],[62.4,109.2],[61,108.8],[59.6,108.5],[58.2,108.2],[56.8,107.9],[55.4,107.5],[54,107.2],[52.6,106.8],[51.3,106.4],[49.9,106],[48.5,105.5],[47.2,105],[45.9,104.5],[44.6,103.9],[43.3,103.2],[42.1,102.4],[40.9,101.6],[39.8,100.7],[38.7,99.8],[37.7,98.7],[36.8,97.7],[35.9,96.5],[35.1,95.3],[34.3,94.1],[33.7,92.8],[33.1,91.5],[32.5,90.2],[32,88.8],[31.6,87.5],[31.2,86.1],[30.9,84.7],[30.6,83.3],[30.4,81.9],[30.2,80.4],[30.1,79],[30,77.6],[30,76.1],[30,74.7],[30.1,73.3],[30.2,71.8],[30.4,70.4],[30.6,69],[30.8,67.6],[31.1,66.2],[31.4,64.8],[31.8,63.4],[32.3,62],[32.7,60.6],[33.2,59.3],[33.8,58],[34.4,56.7],[35.1,55.4],[35.8,54.2],[36.6,53],[37.4,51.8],[38.3,50.6],[39.1,49.5],[40.1,48.5],[41.2,47.5],[42.3,46.5],[43.4,45.7],[44.6,44.9],[45.8,44.1],[47,43.4],[48.3,42.7],[49.6,42.1],[50.9,41.5],[52.3,41],[53.6,40.5],[55,40.1],[56.4,39.6],[57.7,39.2],[59.1,38.9],[60.5,38.6],[61.9,38.2],[63.3,38],[64.8,37.7],[66.2,37.5],[67.6,37.3],[69,37.1],[70.4,37],[71.9,36.8],[73.3,36.7],[74.7,36.6],[76.2,36.5],[77.6,36.4],[79,36.3],[80.5,36.2],[81.9,36.2],[83.3,36.1],[84.8,36.1],[86.2,36.1],[87.7,36],[89.1,36],[90.5,36],[92,36],[93.4,36],[94.8,36],[96.3,36],[97.7,36],[99.1,36],[100.6,36],[102,36],[103.5,36],[104.9,36],[106.3,36.1],[107.8,36.1],[109.2,36.2],[110.6,36.2],[112.1,36.3],[113.5,36.4],[114.9,36.5],[116.4,36.7],[117.8,36.8],[119.2,37],[120.6,37.3],[122,37.5],[123.4,37.8],[124.8,38.2],[126.2,38.6],[127.6,39],[129,39.5],[130.3,40],[131.6,40.5],[132.9,41.1],[134.2,41.8],[135.4,42.5],[136.7,43.2],[137.9,44],[139,44.9],[140.2,45.8],[141.2,46.7],[142.2,47.7],[143.1,48.9],[144,50],[144.8,51.2],[145.5,52.5],[146.1,53.8],[146.7,55.1],[147.2,56.4],[147.7,57.8],[148.1,59.1],[148.5,60.5],[148.9,61.9],[149.1,63.3],[149.4,64.7],[149.6,66.2],[149.7,67.6],[149.9,69],[149.9,70.5],[150,71.9],[150,73.3],[149.9,74.8],[149.9,76.2],[149.7,77.6],[149.6,79.1],[149.4,80.5],[149.2,81.9],[148.9,83.3],[148.6,84.7],[148.2,86.1],[147.8,87.5],[147.3,88.8],[146.8,90.1],[146.2,91.5],[145.5,92.7],[144.8,94],[144,95.2],[143.2,96.4],[142.3,97.5],[141.3,98.6],[140.3,99.5],[139.2,100.5],[138.1,101.3],[136.9,102.1],[135.6,102.8],[134.3,103.5],[133,104],[131.6,104.5],[130.3,104.9],[128.9,105.3],[127.5,105.6],[126.1,105.9],[124.7,106.2],[123.3,106.5],[121.9,106.8],[120.5,107.1],[119.1,107.5],[117.7,108],[116.4,108.5],[115.1,109.2],[113.9,109.9],[112.7,110.8],[111.6,111.7],[110.6,112.7],[109.7,113.8],[108.7,114.9],[107.8,116],[106.9,117.1],[106.1,118.3],[105.3,119.5],[104.5,120.6],[103.7,121.8],[102.9,123.1],[102.1,124.3],[101.4,125.5],[100.6,126.7],[99.8,127.9],[98.9,129],[97.9,130.1],[96.8,131],[95.6,131.7]],"dot":[[138,144],[136.4,143.9],[134.9,143.6],[133.4,143.1],[132,142.4],[130.7,141.5],[129.5,140.5],[128.5,139.3],[127.6,138],[126.9,136.6],[126.4,135.1],[126.1,133.6],[126,132],[126.1,130.4],[126.4,128.9],[126.9,127.4],[127.6,126],[128.5,124.7],[129.5,123.5],[130.7,122.5],[132,121.6],[133.4,120.9],[134.9,120.4],[136.4,120.1],[138,120],[139.6,120.1],[141.1,120.4],[142.6,120.9],[144,121.6],[145.3,122.5],[146.5,123.5],[147.5,124.7],[148.4,126],[149.1,127.4],[149.6,128.9],[149.9,130.4],[150,132],[149.9,133.6],[149.6,135.1],[149.1,136.6],[148.4,138],[147.5,139.3],[146.5,140.5],[145.3,141.5],[144,142.4],[142.6,143.1],[141.1,143.6],[139.6,143.9]]};
var SETS={envelope:{K:K,SX:SX,SY:SY,B:B,F:F,D:D,FC:FC,DC:DC,FR:FR,DR:DR,G:ENV_GRADS,DG:null}},DOTG=null,cur='envelope';
(function(){var k=1.1,sx=89,sy=90;function lc(a){return a.map(function(p){return [CX+k*(p[0]-sx),CX+k*(p[1]-sy)]})}
var b=lc(CHATD.body),dd=lc(CHATD.dot);
SETS.chat={K:k,SX:sx,SY:sy,B:b,F:null,D:dd,FC:null,DC:cen(dd),FR:0,DR:Math.sqrt(areaOf(dd)/Math.PI),
 G:[['245,127,112',[-75.5625,-67.6189,84.4615,-40.7274,150,132.071]],['116,52,152',[34.125,31.2845,-40.2778,19.7327,30,36]],['104,58,148',[-56.1947,47.9608,-50.4529,-41.8652,150,36]]],
 DG:[['245,127,112',[-15.1125,-16.8923,16.8923,-10.1744,150,144]],['116,52,152',[6.825,7.81538,-8.05556,4.92955,126,120]],['104,58,148',[-11.2389,11.9814,-10.0906,-10.4586,150,120]]]}})();
function useSet(n){var S=SETS[n];K=S.K;SX=S.SX;SY=S.SY;B=S.B;F=S.F;D=S.D;FC=S.FC;DC=S.DC;FR=S.FR;DR=S.DR;ENV_GRADS=S.G;DOTG=S.DG;cur=n}
var ENV_COLOR_SHIFT=true,CYAN=[240,112,140],CORAL=[245,127,112];
var envRot=0,envShift=0;
function paintEnv(ctx,a,rot,mix,G){
  if(a<=0)return;ctx.globalAlpha=a;ctx.fillStyle='#852A9C';ctx.fillRect(0,0,260,260);
  (G||ENV_GRADS).forEach(function(g,gi){ctx.save();ctx.translate(CX,CY);ctx.rotate(rot);ctx.translate(-CX,-CY);ctx.translate(CX-K*SX,CY-K*SY);ctx.scale(K,K);ctx.transform.apply(ctx,g[1]);
    var gr=ctx.createRadialGradient(0,0,0,0,0,1);var col=g[0];if(gi===0&&mix>0){col=[0,1,2].map(function(k){return Math.round(CORAL[k]+(CYAN[k]-CORAL[k])*mix*0.85)}).join(',')}
    gr.addColorStop(0,'rgba('+col+',1)');gr.addColorStop(1,'rgba('+col+',0)');ctx.fillStyle=gr;ctx.fillRect(-1.1,-1.1,2.2,2.2);ctx.restore()});
  ctx.globalAlpha=1;
}
var ROSE={base:'#591E9A',spots:[{angle:Math.PI*.75,r:1.8,color:'#F57F70',opacity:1},{angle:Math.PI*.6,r:1.4,color:'#683A94',opacity:.85}]};
var WARM={base:'#3F0786',spots:[{angle:Math.PI*.75,r:1.8,color:'#F57F70',opacity:1},{angle:Math.PI*.6,r:1.4,color:'#852A9C',opacity:.85}]};
var COOL={base:'#3F0786',spots:[{angle:Math.PI*.75,r:1.8,color:'#2CC5E9',opacity:1},{angle:Math.PI*.6,r:1.4,color:'#591E9A',opacity:.7}]};
var kernels={};
function kernel(s){var key=Math.round(s*10);if(kernels[key])return kernels[key];var h=Math.max(1,Math.ceil(s*3)),k=[],sum=0,i,v;for(i=-h;i<=h;i++){v=Math.exp(-i*i/(2*s*s));k.push(v);sum+=v}for(i=0;i<k.length;i++)k[i]/=sum;return kernels[key]={h:h,k:k}}
function lowpass(P,s){var K2=kernel(s),n=P.length,out=new Array(n),i,j,x,y;for(i=0;i<n;i++){x=0;y=0;for(j=-K2.h;j<=K2.h;j++){var q=P[(i+j+n)%n],w=K2.k[j+K2.h];x+=q[0]*w;y+=q[1]*w}out[i]=[x,y]}return out}
/* a droplet that is left behind as the body retracts: grows from inside the mass, necks, pinches off, settles */
function droplet(T,c,req,p,delta,phase,ts,n,id){
  id=id||{am:0,fx:0,fy:0,ax:0,ay:0,rot:0,rip:0};
  var dx=CX-c[0],dy=CY-c[1],dl=Math.hypot(dx,dy)||1;dx/=dl;dy/=dl;
  var sh=sm(p),sc=0.12+0.88*Math.pow(sh,0.65),st=0.24*(1-p)*(1-p),x1=p-1,eob=1+2.4*x1*x1*x1+1.4*x1*x1;
  var off=delta*(1-eob),px=c[0]+dx*off,py=c[1]+dy*off,out=new Array(n);
  for(var i=0;i<n;i++){
    var b=Math.PI/2+i/n*TAU,cx=Math.cos(b)*req,cy=Math.sin(b)*req;
    var vx=cx+(T[i][0]-c[0]-cx)*sh,vy=cy+(T[i][1]-c[1]-cy)*sh;
    var rp=1+(0.06*(1-p)+0.016+id.rip*id.am)*Math.sin(2*b+ts*0.0011+phase)+(0.01)*Math.cos(3*b-ts*0.0008+phase);
    vx*=sc*rp;vy*=sc*rp;
    var t=vx*dx+vy*dy,qx=vx-t*dx,qy=vy-t*dy,sq=1/Math.sqrt(1+st);
    var ox=dx*t*(1+st)+qx*sq,oy=dy*t*(1+st)+qy*sq,cr=Math.cos(id.rot*id.am),sr=Math.sin(id.rot*id.am);
    out[i]=[px+ox*cr-oy*sr+id.ax*id.am,py+ox*sr+oy*cr+id.ay*id.am]}
  return out}
function addPoly(path,P){var n=P.length;path.moveTo((P[0][0]+P[n-1][0])/2,(P[0][1]+P[n-1][1])/2);for(var i=0;i<n;i++){var c=P[i],q=P[(i+1)%n];path.quadraticCurveTo(c[0],c[1],(c[0]+q[0])/2,(c[1]+q[1])/2)}path.closePath()}
function nearest(A,Bp,sa,sb){var best=1e9,ia=0,ib=0;for(var i=0;i<A.length;i+=sa){for(var j=0;j<Bp.length;j+=sb){var dx=A[i][0]-Bp[j][0],dy=A[i][1]-Bp[j][1],d=dx*dx+dy*dy;if(d<best){best=d;ia=i;ib=j}}}return [Math.sqrt(best),ia,ib]}
/* the liquid neck between a droplet and the body: an hourglass that thins to nothing before it breaks */
function neck(path,body,dp,c,we,G,k){
  we*=k;if(k<0.03)return;
  var r=nearest(dp,body,2,3);if(r[0]>=G||r[0]<0.01)return;
  var a=dp[r[1]],b=body[r[2]],g=r[0]/G,wm=we*Math.pow(1-g,2.2);
  var dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy)||1,ux=dx/l,uy=dy/l,nx=-uy,ny=ux;
  var bl=Math.hypot(CX-b[0],CY-b[1])||1,ax=a[0]+(c[0]-a[0])*0.0,ay=a[1];
  var a2=[a[0]-ux*we*0.9,a[1]-uy*we*0.9],b2=[b[0]+(CX-b[0])/bl*we*0.9,b[1]+(CY-b[1])/bl*we*0.9];
  var mx=(a2[0]+b2[0])/2,my=(a2[1]+b2[1])/2,co=2*wm-we;
  var P=[[a2[0]+nx*we,a2[1]+ny*we],[b2[0]+nx*we,b2[1]+ny*we],[b2[0]-nx*we,b2[1]-ny*we],[a2[0]-nx*we,a2[1]-ny*we]];
  var s=0;for(var i=0;i<4;i++){var q=P[(i+1)%4];s+=P[i][0]*q[1]-q[0]*P[i][1]}
  if(s<0){nx=-nx;ny=-ny;P=[[a2[0]+nx*we,a2[1]+ny*we],[b2[0]+nx*we,b2[1]+ny*we],[b2[0]-nx*we,b2[1]-ny*we],[a2[0]-nx*we,a2[1]-ny*we]]}
  path.moveTo(P[0][0],P[0][1]);path.quadraticCurveTo(mx+nx*co,my+ny*co,P[1][0],P[1][1]);path.lineTo(P[2][0],P[2][1]);path.quadraticCurveTo(mx-nx*co,my-ny*co,P[3][0],P[3][1]);path.closePath()}

var cv,ctx,d=1,gl,gctx,GW=0,fromP=ROSE,toP=ROSE,fadeT=1,fadeDur=800,ph=0,A=0,Bo=0,rp=0,target=0,dur=1600,lastTs=0;
function draw(ts){
  if(!cv)return;
  var dt=Math.min(ts-lastTs,50);lastTs=ts;
  if(rp!==target){rp+=(target>rp?1:-1)*dt/dur;rp=target>rp?Math.min(rp,target):Math.max(rp,target);if(rp<=0)rp=0;if(rp>=1)rp=1}
  var m=sm5(rp),im=1-m;
  ph+=dt*0.00065*im*im;A+=dt*0.00065*im*im*im;
  var orb=A+Bo*im;
  if(fadeT<1)fadeT=Math.min(1,fadeT+dt/fadeDur);
  var pr=fadeT>=1?toP:lerpPreset(fromP,toP,fadeT);if(fadeT>=1)fromP=toP;
  var pulse=1-0.02*Math.sin(ts*0.0011),bounce=Math.sin(ts*0.0008)*6*(1-0.6*m);
  cv.style.transform='translateY('+bounce.toFixed(2)+'px)';
  /* body: circle -> envelope, travelling outline; the top (where the notch forms) lags */
  var L=0.35,pts=new Array(N),i;
  for(i=0;i<N;i++){
    var a=Math.PI/2+i/N*TAU,r=R0*(1+im*(0.10*Math.sin(2*a+ph*1.4)+0.07*Math.cos(3*a-ph))+0.055*Math.sin(ph*1.15)*im);
    var x=CX+Math.cos(a)*r,y=CY+Math.sin(a)*r,q=0.5*(1+Math.cos(a+Math.PI/2)),e=sm(m*(1+L)-L*q);
    pts[i]=[x+(B[i][0]-x)*e,y+(B[i][1]-y)*e]}
  var sg=2.6*im+0.7*m;pts=lowpass(pts,sg);
  var am=sm5((m-0.8)/0.2);
  envRot+=dt*0.00028*am;envShift+=dt*am*TAU/22000;
  if(am>0){var bx=Math.sin(ts*0.0007)*1.4*am,by=Math.cos(ts*0.0009)*1.0*am;
    for(i=0;i<N;i++){var th=Math.PI/2+i/N*TAU,ux=pts[i][0]-CX,uy=pts[i][1]-CY,ul=Math.hypot(ux,uy)||1,
      dr=am*(1.5*Math.sin(2*th+ts*0.0010)+0.9*Math.sin(1*th-ts*0.0007));
      pts[i]=[pts[i][0]+ux/ul*dr+bx,pts[i][1]+uy/ul*dr+by]}}
  var fp=sm((m-0.22)/0.72),dp=sm((m-0.40)/0.60),all=[pts],fd=null,dd=null;
  if(fp>0.02&&F)fd=droplet(F,FC,FR,fp,26,0,ts,M,{am:am,fx:1.15,ax:Math.sin(ts*0.0013)*2.2,ay:Math.cos(ts*0.0010)*1.8,rot:Math.sin(ts*0.0008)*0.05,rip:0.012});
  if(dp>0.02)dd=droplet(D,DC,DR,dp,20,2,ts,MD,{am:am,fx:0.85,ax:Math.sin(ts*0.0017+1)*2.6,ay:Math.cos(ts*0.0013+2)*3.2,rot:Math.sin(ts*0.001+3)*0.2,rip:0.02});
  function pu(P){return P.map(function(p){return [CX+(p[0]-CX)*pulse,CY+(p[1]-CY)*pulse]})}
  var body=pu(pts);if(fd)fd=pu(fd);if(dd)dd=pu(dd);
  var path=new Path2D();addPoly(path,body);
  if(fd){addPoly(path,fd);neck(path,body,fd,FC,FR*0.5,17,1-sm((fp-0.6)/0.3))}
  if(dd){addPoly(path,dd);neck(path,body,dd,DC,DR*0.55,13,1-sm((dp-0.6)/0.3))}
  ctx.setTransform(d,0,0,d,0,0);ctx.clearRect(0,0,260,260);ctx.save();ctx.clip(path);
  var ea=sm((m-0.30)/0.55);paintGradient(ctx,pr,260,orb);paintEnv(ctx,ea,envRot,(ENV_COLOR_SHIFT&&cur==='envelope')?0.5-0.5*Math.cos(envShift):0);ctx.restore();
  if(DOTG&&dd){ctx.save();var dpth=new Path2D();addPoly(dpth,dd);ctx.clip(dpth);paintGradient(ctx,pr,260,orb);paintEnv(ctx,ea,0,0,DOTG);ctx.restore()}
  if(gctx){gctx.clearRect(0,0,GW,GW);gctx.drawImage(cv,0,0,GW,GW)}
}
return{
 mount:function(el,o){o=o||{};cv=el;d=Math.min(window.devicePixelRatio||1,2);var s=el.offsetWidth||260;el.width=el.height=Math.round(s*d);d=el.width/260;ctx=el.getContext('2d');
  if(o.glow){gl=o.glow;GW=Math.max(96,Math.round((gl.offsetWidth||480)*0.32));gl.width=gl.height=GW;gctx=gl.getContext('2d')}
  lastTs=0;return this},
 setShape:function(name,ms){var t=name==='blob'?0:1;if(t===1&&rp===0&&name!==cur)useSet(name);if(t===target)return this;
  if(t===1&&rp===0){Bo=wrapPi(A);A=0;envRot=0;envShift=0}
  target=t;dur=ms===undefined?1600:ms;if(dur===0)rp=t;return this},
 frame:draw,
 unmount:function(){cv=ctx=gl=gctx=null;return this},
 /* what the host needs to hand the blob over from the other engine without a jump */
 getOrbit:function(){return A+Bo*(1-sm5(rp))},
 seed:function(orbit,preset){A=orbit;Bo=0;ph=orbit;fromP=preset;toP=preset;fadeT=1;rp=0;target=0},
 isBlob:function(){return rp===0&&target===0},
 setName:function(){return cur},
 getPreset:function(){return fadeT>=1?toP:lerpPreset(fromP,toP,fadeT)},
 setPreset:function(p,ms){fromP=fadeT<1?lerpPreset(fromP,toP,fadeT):toP;toP=p;if(ms===0){fadeT=1;fromP=p}else{fadeT=0;fadeDur=ms===undefined?800:ms}return this}
};
}

/* ================================================================== the host: one blob (or glow), both engines, one loop */
const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function create(canvas, opts = {}) {
  const o = { shape: 'blob', theme: 'auto', glow: null, glowHost: null, asGlow: false, bloblets: true, ...opts };
  const P = createPolarEngine();
  let T = null, active = 'P';
  const engine = () => (active === 'P' ? P : T);
  const mountOpts = () => ({ glow: o.glow, glowHost: o.glowHost, asGlow: o.asGlow });

  let themeAuto = false, cycleIdx = 0, lastCycle = null;
  let want = { shape: 'blob', ms: 0 };

  P.mount(canvas, mountOpts());
  if (o.asGlow || !o.bloblets) P.setBloblets(false);
  P.setPreset(CYCLE[0], 0);

  function setTheme(name, ms) {
    if (reduceMotion) ms = 0;
    if (name === 'auto') { themeAuto = true; return; }
    themeAuto = false;
    const preset = typeof name === 'string' ? THEMES[name] : name;
    if (preset) engine().setPreset(preset, ms === undefined ? 800 : ms);
  }
  function setShape(name, ms) {
    if (!SHAPES.includes(name)) name = 'blob';
    want = { shape: name, ms: reduceMotion ? 0 : (ms === undefined ? 1100 : ms) };
    if (o.asGlow && TRACED.has(name)) want.shape = 'blob';   // an independent glow only ever swells with the polar shapes
  }

  // hand the canvas from one engine to the other, keeping the colours and the phase of the drift
  function toTraced() {
    T = T || createTracedEngine();
    T.mount(canvas, mountOpts()); T.seed(P.getOrbit(), P.getPreset());
    P.unmount(); active = 'T';
  }
  function toPolar() {
    P.mount(canvas, mountOpts()); P.setOrbit(T.getOrbit()); P.setPreset(T.getPreset(), 0);
    if (o.asGlow || !o.bloblets) P.setBloblets(false);
    T.unmount(); active = 'P';
  }
  function steer() {
    const traced = TRACED.has(want.shape), half = Math.max(0, Math.round(want.ms / 2));
    if (active === 'P') {
      if (!traced) P.setShape(want.shape, want.ms);
      else if (P.isHome()) { toTraced(); T.setShape(want.shape, want.ms); }
      else P.setShape('blob', half);                       // a traced shape is reached through the plain blob
    } else if (traced) {
      if (T.setName() === want.shape || T.isBlob()) T.setShape(want.shape, want.ms);
      else T.setShape('blob', half);                       // envelope -> chat goes via the blob too
    } else {
      T.setShape('blob', half);
      if (T.isBlob()) { toPolar(); P.setShape(want.shape, want.ms); }
    }
  }

  setTheme(o.theme, 0);
  setShape(o.shape, 0);
  steer(); steer();

  return {
    canvas,
    setShape, setTheme,
    attachGlow(glowCanvas, glowHost) { o.glow = glowCanvas; o.glowHost = glowHost; engine().mount(canvas, mountOpts()); },
    resize() { engine().mount(canvas, mountOpts()); },   // re-reads the canvas size
    frame(ts) {
      if (themeAuto) {
        if (lastCycle === null) lastCycle = ts;
        if (ts - lastCycle > CYCLE_EVERY_MS) { lastCycle = ts; cycleIdx = (cycleIdx + 1) % CYCLE.length; engine().setPreset(CYCLE[cycleIdx], reduceMotion ? 0 : CYCLE_FADE_MS); }
      }
      steer();
      engine().frame(ts);
    },
    destroy() { P.unmount(); if (T) T.unmount(); },
  };
}

/* ================================================================== finding .blob and .glow elements on the page */
const live = new Map();          // element -> { ctrl, visible }
let raf = 0;
const io = typeof IntersectionObserver === 'function' ? new IntersectionObserver((entries) => {
  for (const e of entries) { const rec = live.get(e.target); if (rec) rec.visible = e.isIntersecting; }
}) : null;

function tick(ts) {
  raf = requestAnimationFrame(tick);
  for (const rec of live.values()) if (rec.visible) rec.ctrl.frame(ts);
}
const ensureLoop = () => { if (!raf && !reduceMotion) raf = requestAnimationFrame(tick); };

const attrs = (el) => ({ shape: el.dataset.shape || 'blob', theme: el.dataset.theme || 'auto' });

function mount(el) {
  if (live.has(el) || el.__blobPending) return;
  let canvas = el.querySelector(':scope > canvas');
  if (!canvas) { canvas = document.createElement('canvas'); canvas.setAttribute('aria-hidden', 'true'); el.append(canvas); }
  // wait until the canvas has a size (the stylesheet may still be loading)
  if (!canvas.offsetWidth) {
    el.__blobPending = true;
    const ro = new ResizeObserver(() => { if (canvas.offsetWidth) { ro.disconnect(); el.__blobPending = false; mount(el); } });
    ro.observe(canvas); return;
  }
  const isGlow = el.classList.contains('glow');
  const a = attrs(el);
  // a glow tied to a blob (data-for) is drawn by that blob; give the blob our canvas instead of starting our own
  if (isGlow && el.dataset.for) {
    const target = document.getElementById(el.dataset.for);
    const rec = target && live.get(target);
    if (rec) { rec.ctrl.attachGlow(canvas, el); el.__linked = true; return; }
    if (target) { el.__waiting = true; return; }   // the blob is not mounted yet: it will pick this glow up
  }
  let glowEl = null;
  if (!isGlow && el.id) glowEl = document.querySelector(`.glow[data-for="${CSS.escape(el.id)}"]`);
  let glowCanvas = null;
  if (glowEl) { glowCanvas = glowEl.querySelector(':scope > canvas'); if (!glowCanvas) { glowCanvas = document.createElement('canvas'); glowCanvas.setAttribute('aria-hidden', 'true'); glowEl.append(glowCanvas); } glowEl.__linked = true; }
  const ctrl = create(canvas, { shape: a.shape, theme: a.theme, glow: glowCanvas, glowHost: glowEl, asGlow: isGlow });
  const rec = { ctrl, visible: true, last: a.shape + '|' + a.theme };
  live.set(el, rec);
  if (io) { rec.visible = false; io.observe(el); }
  ctrl.frame(performance.now());                // something on screen straight away, even before the first animation frame
  ctrl.frame(performance.now() + 16);
  ensureLoop();
  new ResizeObserver(() => { if (canvas.offsetWidth) ctrl.resize(); }).observe(canvas);
}

function sync(el) {
  const rec = live.get(el); if (!rec) return;
  const a = attrs(el), key = a.shape + '|' + a.theme;
  if (key === rec.last) return;
  const [shape, theme] = rec.last.split('|');
  rec.last = key;
  if (a.shape !== shape) rec.ctrl.setShape(a.shape, 1100);
  if (a.theme !== theme) rec.ctrl.setTheme(a.theme, 1200);
  if (reduceMotion) { rec.ctrl.frame(performance.now()); rec.ctrl.frame(performance.now() + 16); }
}

const scan = (root) => {
  if (root.nodeType !== 1 && root !== document) return;
  const q = root.querySelectorAll ? [...root.querySelectorAll('.blob, .glow')] : [];
  if (root.matches && root.matches('.blob, .glow')) q.unshift(root);
  q.filter((e) => e.classList.contains('blob')).forEach(mount);    // blobs first, so they pick up their glows
  q.filter((e) => e.classList.contains('glow')).forEach(mount);
};
const forget = (el) => { const rec = live.get(el); if (rec) { rec.ctrl.destroy(); live.delete(el); io && io.unobserve(el); } };

if (typeof document !== 'undefined') {
  scan(document);
  new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'attributes') { sync(r.target); continue; }
      r.addedNodes.forEach((n) => { if (n.nodeType === 1) { scan(n); } });
      r.removedNodes.forEach((n) => { if (n.nodeType === 1) { (n.matches && n.matches('.blob, .glow') ? [n] : []).concat([...(n.querySelectorAll ? n.querySelectorAll('.blob, .glow') : [])]).forEach((e) => { if (!e.isConnected) forget(e); }); } });
    }
  }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-shape', 'data-theme'] });
}

if (typeof window !== 'undefined') window.TBlob = { create, THEMES, SHAPES };
