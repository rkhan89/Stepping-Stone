import Link from "next/link";
import { Screen, Wordmark } from "@/components/ui";
import { UnderlineDouble } from "@/components/marks";
import { ResumeBanner } from "@/components/resume-banner";

export default function Landing() {
  return (
    <Screen className="pb-[46px] pt-[74px]">
      <Wordmark />

      <div className="flex-1" />

      <h1 className="t-display m-0 text-[47px]">
        Stop researching.
        <br />
        Start{" "}
        <span className="relative whitespace-nowrap">
          doing.
          <UnderlineDouble className="absolute -bottom-[11px] -left-1" />
        </span>
      </h1>

      <p className="mt-9 text-[18px] leading-[1.52] text-[#17262b]/80">
        Tell Stepping Stone what you want to start. We do the digging: real jobs to
        apply to, real places to go, real first steps. Not another list of tips
        you&rsquo;ll never open again.
      </p>

      <ResumeBanner />

      <div className="mt-9 flex flex-col gap-4">
        <Link href="/start" className="ss-btn text-[19px]">
          What do you want to start?
        </Link>
        <div className="t-hand pl-[3px] text-[18px] leading-[1.35] text-[#17262b]/60">
          A job. A stall at the market. Welding. Anything.
        </div>
      </div>

      <div className="flex-1" />

      <div className="border-t border-[#17262b]/[.16] pt-5 text-[14.5px] leading-[1.5] text-[#17262b]/55">
        One step at a time. Tick it off, get the next one. No account until
        you&rsquo;ve seen it working.
      </div>
    </Screen>
  );
}
