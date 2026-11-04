import * as fs from "fs";
import * as path from "path";
import { DAY1_HOWTO_COPY } from "@/constants/day1HowtoCopy";
import {
  buildFirstSessionAbandonedPayload,
  day1HowtoCopy,
  day1HowtoLayout,
  howtoDwellMs,
  resolveDay1AbandonPhase,
  shouldShowDay1HowtoCard,
  HOWTO_DWELL_MS_MAX,
} from "../day1Howto";

const BANNED =
  /\b(doctor|therapist|condition|results?|timeline|weeks?|cure|treat|diagnos|incontinence|bladder)\b/i;

describe("P7a how-to card", () => {
  it("uses the claims-cleared strings, including the em dash", () => {
    expect(DAY1_HOWTO_COPY.headline).toBe("Before your first rep");
    expect(DAY1_HOWTO_COPY.lines).toEqual([
      "Find it: it's the muscle you'd use to stop your pee. That's just to find it. Don't practice while peeing.",
      "Lift and hold. Keep breathing, and keep your glutes, thighs and abs relaxed.",
      "How you'll know you're doing it right: a gentle lift inside, and nothing else moves.",
    ]);
    expect(DAY1_HOWTO_COPY.continueLabel).toBe("Got it \u2014 start");
    expect(DAY1_HOWTO_COPY.skipLabel).toBe("Skip");
    expect(DAY1_HOWTO_COPY.moreTipsLabel).toBe("More form tips");
    expect(DAY1_HOWTO_COPY.lines).toHaveLength(3);
  });

  it("uses the same copy for every anatomy type", () => {
    expect(day1HowtoCopy("male")).toBe(DAY1_HOWTO_COPY);
    expect(day1HowtoCopy("female")).toBe(DAY1_HOWTO_COPY);
    expect(day1HowtoCopy(null)).toBe(DAY1_HOWTO_COPY);
  });

  it("does not mention conditions, results, timelines, doctors, or therapists", () => {
    const blob = [
      DAY1_HOWTO_COPY.headline,
      ...DAY1_HOWTO_COPY.lines,
      DAY1_HOWTO_COPY.continueLabel,
      DAY1_HOWTO_COPY.skipLabel,
      DAY1_HOWTO_COPY.moreTipsLabel,
    ].join(" ");
    expect(blob).not.toMatch(BANNED);
  });

  it("shows once, only before the first squeeze, and never after Day 1", () => {
    const fresh = {
      isFirstSession: true,
      day1Completed: false,
      howtoCardSeen: false,
      resumeStepIndex: 0,
    };
    expect(shouldShowDay1HowtoCard(fresh)).toBe(true);
    expect(shouldShowDay1HowtoCard({ ...fresh, howtoCardSeen: true })).toBe(
      false,
    );
    expect(shouldShowDay1HowtoCard({ ...fresh, day1Completed: true })).toBe(
      false,
    );
    expect(shouldShowDay1HowtoCard({ ...fresh, isFirstSession: false })).toBe(
      false,
    );
    expect(shouldShowDay1HowtoCard({ ...fresh, resumeStepIndex: 1 })).toBe(
      false,
    );
    expect(shouldShowDay1HowtoCard({ ...fresh, resumeStepIndex: null })).toBe(
      true,
    );
  });

  it("does not scroll a small phone at default text, and does scroll large text", () => {
    const phone = day1HowtoLayout({
      width: 320,
      height: 568,
      fontScale: 1,
      largeText: false,
    });
    expect(phone.scrollBody).toBe(false);
    expect(phone.maxWidth).toBe(320);
    expect(phone.compact).toBe(true);

    expect(
      day1HowtoLayout({
        width: 320,
        height: 568,
        fontScale: 1,
        largeText: true,
      }).scrollBody,
    ).toBe(true);
    expect(
      day1HowtoLayout({
        width: 390,
        height: 844,
        fontScale: 1.3,
        largeText: false,
      }).scrollBody,
    ).toBe(true);

    const duo = day1HowtoLayout({
      width: 900,
      height: 700,
      fontScale: 1,
      largeText: false,
    });
    expect(duo.maxWidth).toBe(560);
    expect(duo.scrollBody).toBe(false);
    expect(duo.compact).toBe(false);
  });

  it("clamps card dwell and builds the abandon payload", () => {
    expect(howtoDwellMs(1_000, 1_500)).toBe(500);
    expect(howtoDwellMs(null, 1_500)).toBe(0);
    expect(howtoDwellMs(0, HOWTO_DWELL_MS_MAX + 5_000)).toBe(
      HOWTO_DWELL_MS_MAX,
    );

    expect(resolveDay1AbandonPhase({ cardVisible: true })).toBe("howto_card");
    expect(
      resolveDay1AbandonPhase({
        cardVisible: false,
        segmentType: "getReady",
        phase: "squeeze",
      }),
    ).toBe("get_ready");
    expect(
      resolveDay1AbandonPhase({
        cardVisible: false,
        segmentType: "slowHolds",
        phase: "rest",
      }),
    ).toBe("rest");
    expect(
      resolveDay1AbandonPhase({
        cardVisible: false,
        segmentType: "breathing",
        segmentId: "fs-short-cooldown",
        phase: "squeeze",
      }),
    ).toBe("cool_down");

    expect(
      buildFirstSessionAbandonedPayload({
        sessionId: "abc",
        progress: 40,
        cardVisible: false,
        segmentType: "slowHolds",
        segmentId: "fs-short-slow",
        phase: "squeeze",
        repIndex: 0,
        elapsedSec: 12.9,
        exitSource: "x",
      }),
    ).toEqual({
      session_id: "abc",
      progress: 40,
      phase: "squeeze",
      rep_index: 1,
      elapsed_sec: 12,
      exit_source: "x",
    });

    expect(
      buildFirstSessionAbandonedPayload({
        sessionId: "abc",
        progress: 0,
        cardVisible: true,
        elapsedSec: 0,
        exitSource: "android_back",
      }),
    ).toEqual({
      session_id: "abc",
      progress: 0,
      phase: "howto_card",
      elapsed_sec: 0,
      exit_source: "android_back",
    });
  });

  it("keeps the card copy in one module and the player on the shared rest helper", () => {
    const card = fs.readFileSync(
      path.join(__dirname, "../../components/Day1HowtoCard.tsx"),
      "utf8",
    );
    const player = fs.readFileSync(
      path.join(__dirname, "../../screens/WorkoutPlayerScreen.tsx"),
      "utf8",
    );
    expect(card).toContain("day1HowtoCopy");
    expect(card).toContain("layout.maxWidth");
    expect(card).not.toMatch(/balls|marble|doctor|therapist/i);
    expect(player).toContain("phaseCountdownSeconds(");
    expect(player).not.toContain("segment.restSeconds");
    expect(player).toContain('dismissHowtoCard("back")');
    expect(player).toContain('dismissHowtoCard("continue")');
    expect(player).toContain('dismissHowtoCard("skip")');
  });
});
