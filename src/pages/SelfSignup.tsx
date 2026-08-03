import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Loader2, ChevronLeft, ChevronRight, Check, ShieldCheck, Camera, Upload,
  User, Users2, Phone, Mail, MapPin, Star, Plus, PartyPopper, IdCard, KeyRound, X,
  Search, Facebook, Instagram, Linkedin, Youtube, UserPlus, Building2, Medal,
  CalendarDays, Smartphone, MoreHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Request from "@/lib/api/client";
import { SignaturePad } from "@/components/SignaturePad";

/* ------------------------------- Types ------------------------------- */
interface Membership { _id: string; name: string; description?: string; meta?: string; duration?: string; price?: string; memberLimit?: number; benefits?: string[]; }
interface Category { categoryId: string; categoryName: string; memberships: Membership[]; }
interface ClassSub { _id: string; name: string; price?: string; duration?: string; sessions?: string; }
interface ClassItem { _id: string; name: string; meta?: string; subscriptions: ClassSub[]; }
interface Trainer { _id: string; name: string; image?: string; specialization?: string; bio?: string; experience?: string; }
interface PTPackage { _id: string; name: string; price?: string; duration?: string; sessions?: string; trainer?: Trainer; }
interface MemberField { id: string; label: string; type: string; required?: boolean; builtIn?: boolean; options?: string[]; }
interface Question { id: string; label: string; type: string; required?: boolean; options?: string[]; }
interface EmergencyCfg {
  enabled: boolean; requireRelation?: boolean; requirePhone?: boolean; requireEmail?: boolean;
  showEmail?: boolean; requireAddress?: boolean; showAddress?: boolean; allowMultiple?: boolean;
  minContacts?: number; maxContacts?: number; relationshipOptions?: string[];
}
interface Config {
  gymName: string; gymLogo?: string; gymCover?: string;
  packages: { categories: Category[]; classes: ClassItem[]; personalTrainings: PTPackage[] };
  fields: MemberField[];
  questions: Question[];
  memberPhoto: { enabled: boolean; required?: boolean; allowUpload?: boolean; allowCamera?: boolean };
  emergencyContact: EmergencyCfg;
  askHowHeardAboutUs?: boolean; howHeardRequired?: boolean;
  agreement: { enabled: boolean; conditions: string[] };
  signature: { enabled: boolean; label: string };
  welcome?: { title?: string; message?: string } | null;
}

const GENDER_OPTIONS = ["Male", "Female", "Other"];
// When the portal collects a password it becomes the member's login password, so
// it's always required and must meet this minimum length.
const PASSWORD_MIN_LENGTH = 6;
const HOW_HEARD_OPTIONS: { label: string; icon: JSX.Element }[] = [
  { label: "Google Search", icon: <Search className="w-4 h-4" /> },
  { label: "Facebook", icon: <Facebook className="w-4 h-4" /> },
  { label: "Instagram", icon: <Instagram className="w-4 h-4" /> },
  { label: "LinkedIn", icon: <Linkedin className="w-4 h-4" /> },
  { label: "YouTube", icon: <Youtube className="w-4 h-4" /> },
  { label: "Friend or Referral", icon: <UserPlus className="w-4 h-4" /> },
  { label: "Another Gym", icon: <Building2 className="w-4 h-4" /> },
  { label: "Fitness Coach / Influencer", icon: <Medal className="w-4 h-4" /> },
  { label: "Event / Exhibition", icon: <CalendarDays className="w-4 h-4" /> },
  { label: "App Store / Google Play", icon: <Smartphone className="w-4 h-4" /> },
  { label: "Other", icon: <MoreHorizontal className="w-4 h-4" /> },
];

/* --------------------------- Image upload --------------------------- */
const S3_PUBLIC_BASE = "https://fitrobit-sg.s3.ap-southeast-1.amazonaws.com";

function dataUrlToBlob(dataUrl: string): { blob: Blob; ext: string } | null {
  const m = dataUrl.match(/^data:(.+?);base64,(.*)$/);
  if (!m) return null;
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const ext = (m[1].split("/")[1] || "jpg").replace("jpeg", "jpg");
  return { blob: new Blob([bytes], { type: m[1] }), ext };
}

// Uploads a batch of base64 items to S3 in one presign round-trip (the same
// approach the previous portal used for both member photos and signatures) and
// returns the public url for each requested key.
async function uploadDataUrls(items: { key: string; dataUrl: string }[]): Promise<Record<string, string>> {
  const jobs = items
    .map((it) => {
      if (!it.dataUrl?.startsWith("data:")) return null;
      const parsed = dataUrlToBlob(it.dataUrl);
      return parsed ? { key: it.key, blob: parsed.blob, type: parsed.blob.type } : null;
    })
    .filter(Boolean) as { key: string; blob: Blob; type: string }[];

  const urls: Record<string, string> = {};
  if (!jobs.length) return urls;

  const presigned = await Request.put<{ key: string; url: string }[]>("/members/image-upload", { keys: jobs.map((j) => j.key) });
  const byKey = new Map((presigned || []).map((p) => [p.key, p.url]));
  await Promise.all(jobs.map(async (job) => {
    const putUrl = byKey.get(job.key);
    if (!putUrl) throw new Error("Couldn't get an upload URL");
    await fetch(putUrl, { method: "PUT", headers: { "Content-Type": job.type }, body: job.blob });
    urls[job.key] = `${S3_PUBLIC_BASE}/${job.key}`;
  }));
  return urls;
}

/* ------------------------------ Component ------------------------------ */
type StepKey = "package" | "fields" | "photo" | "emergency" | "questions" | "agreement";

// Shown at the top of each step so the member always knows where they are.
const STEP_TITLES: Record<StepKey, string> = {
  package: "Choose a Package",
  fields: "Your Details",
  photo: "Profile Photo",
  emergency: "Emergency Contact",
  questions: "A Few Questions",
  agreement: "Review & Sign",
};

export default function SelfSignup() {
  const { username } = useParams<{ username: string }>();
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [resultMembers, setResultMembers] = useState<{ memberId?: string; name?: string; phoneNumber?: string; password?: string }[]>([]);

  // Selection
  const [pick, setPick] = useState<{ kind: "membership" | "class" | "pt"; parentId: string; id: string } | null>(null);
  const [drill, setDrill] = useState<{ kind: "category" | "class" | "pt"; id: string } | null>(null);

  // Per-member data (index 0..memberLimit-1). A multi-seat membership collects
  // every one of these steps once per member.
  const [memberFields, setMemberFields] = useState<Record<string, string>[]>([{}]);
  const [memberPhotos, setMemberPhotos] = useState<string[]>([""]);
  const [memberAnswers, setMemberAnswers] = useState<Record<string, any>[]>([{}]);
  const [memberHowHeard, setMemberHowHeard] = useState<string[]>([""]);
  const [memberEmergency, setMemberEmergency] = useState<Record<string, string>[][]>([[{}]]);
  const [memberAgreed, setMemberAgreed] = useState<boolean[]>([false]);
  const [memberSignature, setMemberSignature] = useState<string[]>([""]);

  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await Request.get<{ data?: Config }>(`/users/public/selfsignupconfig/${username}`);
        if (cancelled) return;
        if (res?.data) setConfig(res.data);
        else setNotFound(true);
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [username]);

  // How many members this signup covers (from the picked membership's seat count).
  const memberLimit = useMemo(() => {
    if (pick?.kind !== "membership" || !config) return 1;
    for (const cat of config.packages.categories) {
      const m = cat.memberships.find((mm) => mm._id === pick.id);
      if (m) return Math.max(1, m.memberLimit || 1);
    }
    return 1;
  }, [pick, config]);

  // Keep every per-member array sized to memberLimit.
  useEffect(() => {
    setMemberFields((prev) => Array.from({ length: memberLimit }, (_, i) => prev[i] || {}));
    setMemberPhotos((prev) => Array.from({ length: memberLimit }, (_, i) => prev[i] || ""));
    setMemberAnswers((prev) => Array.from({ length: memberLimit }, (_, i) => prev[i] || {}));
    setMemberHowHeard((prev) => Array.from({ length: memberLimit }, (_, i) => prev[i] || ""));
    setMemberEmergency((prev) => Array.from({ length: memberLimit }, (_, i) => prev[i] || [{}]));
    setMemberAgreed((prev) => Array.from({ length: memberLimit }, (_, i) => prev[i] || false));
    setMemberSignature((prev) => Array.from({ length: memberLimit }, (_, i) => prev[i] || ""));
  }, [memberLimit]);

  // Which steps are active, given the config.
  const steps: StepKey[] = useMemo(() => {
    if (!config) return [];
    const s: StepKey[] = ["package", "fields"];
    if (config.memberPhoto?.enabled) s.push("photo");
    if (config.emergencyContact?.enabled) s.push("emergency");
    if (config.askHowHeardAboutUs || config.questions.length > 0) s.push("questions");
    if (config.agreement?.enabled || config.signature?.enabled) s.push("agreement");
    return s;
  }, [config]);

  const step = steps[stepIdx];
  const isLast = stepIdx === steps.length - 1;

  const canContinue = useMemo(() => {
    if (!config) return false;
    if (step === "package") return !!pick;
    if (step === "fields") {
      return memberFields.slice(0, memberLimit).every((fv) =>
        config.fields.every((f) => {
          const val = (fv[f.id] ?? "").trim();
          // A collected password is always required and must meet the minimum.
          if (f.id === "password") return val.length >= PASSWORD_MIN_LENGTH;
          return !f.required || val.length > 0;
        }),
      );
    }
    if (step === "photo") {
      if (!config.memberPhoto.required) return true;
      return memberPhotos.slice(0, memberLimit).every((p) => !!p);
    }
    if (step === "emergency") {
      const e = config.emergencyContact;
      return Array.from({ length: memberLimit }).every((_, i) => {
        const primary = (memberEmergency[i] || [{}])[0] || {};
        return (primary.name ?? "").trim().length > 0
          && (!e.requirePhone || (primary.phone ?? "").trim().length > 0)
          && (!e.requireRelation || (primary.relation ?? "").trim().length > 0);
      });
    }
    if (step === "questions") {
      return Array.from({ length: memberLimit }).every((_, i) => {
        const howOk = !config.askHowHeardAboutUs || !config.howHeardRequired || !!memberHowHeard[i];
        const ans = memberAnswers[i] || {};
        const qOk = config.questions.every((q) => !q.required || (ans[q.id] != null && String(ans[q.id]).length > 0));
        return howOk && qOk;
      });
    }
    if (step === "agreement") {
      return Array.from({ length: memberLimit }).every((_, i) => {
        const aOk = !config.agreement.enabled || memberAgreed[i];
        const sOk = !config.signature.enabled || (memberSignature[i] || "").length > 10;
        return aOk && sOk;
      });
    }
    return true;
  }, [config, step, pick, memberFields, memberLimit, memberPhotos, memberEmergency, memberHowHeard, memberAnswers, memberAgreed, memberSignature]);

  const submit = async () => {
    if (!config || !pick) return;
    setSubmitting(true);
    try {
      const stamp = Date.now();
      const rnd = Math.random().toString(36).slice(2, 8);
      // Deterministic keys per member, so we can map the uploaded urls back.
      const photoKeys = Array.from({ length: memberLimit }, (_, i) =>
        (memberPhotos[i] || "").startsWith("data:") ? `member-images/${username}/${stamp}_${i}_${rnd}.jpg` : null);
      const sigKeys = Array.from({ length: memberLimit }, (_, i) =>
        (memberSignature[i] || "").startsWith("data:") ? `signatures/${username}/${stamp}_${i}_${rnd}.png` : null);

      // Upload every photo AND signature to S3 in one round-trip.
      const uploadItems: { key: string; dataUrl: string }[] = [];
      photoKeys.forEach((k, i) => { if (k) uploadItems.push({ key: k, dataUrl: memberPhotos[i] }); });
      sigKeys.forEach((k, i) => { if (k) uploadItems.push({ key: k, dataUrl: memberSignature[i] }); });
      const urls = await uploadDataUrls(uploadItems);

      const members = Array.from({ length: memberLimit }, (_, i) => ({
        fields: memberFields[i] || {},
        image: photoKeys[i] ? urls[photoKeys[i]!] : ((memberPhotos[i] || "").startsWith("data:") ? "" : (memberPhotos[i] || "")),
        signature: sigKeys[i] ? urls[sigKeys[i]!] : ((memberSignature[i] || "").startsWith("data:") ? "" : (memberSignature[i] || "")),
        answers: memberAnswers[i] || {},
        emergencyContacts: (memberEmergency[i] || []).filter((c) => (c.name ?? "").trim()),
        howHeardAboutUs: memberHowHeard[i] || null,
        agreement: !!memberAgreed[i],
      }));

      const res = await Request.post<{ members?: any[] }>(`/public/selfsignup/${username}`, {
        pickKind: pick.kind,
        planId: pick.id,
        classId: pick.kind === "class" ? pick.parentId : undefined,
        members,
      });
      setResultMembers(res?.members ?? []);
      setDone(true);
    } catch (err: any) {
      const data = err?.response?.data;
      toast.error((typeof data === "string" ? data : data?.error) || err?.message || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const onContinue = () => {
    if (!canContinue) return;
    if (isLast) submit();
    else setStepIdx((i) => Math.min(steps.length - 1, i + 1));
  };
  const onBack = () => setStepIdx((i) => Math.max(0, i - 1));

  /* ------------------------------ Render ------------------------------ */
  if (loading) {
    return <Center><Loader2 className="w-8 h-8 animate-spin text-primary" /></Center>;
  }
  if (notFound || !config) {
    return <Center><p className="text-muted-foreground text-sm">This signup link isn’t available.</p></Center>;
  }
  if (done) {
    return <WelcomeScreen config={config} members={resultMembers} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/30 to-background flex flex-col">
      {/* Header — gym on the left, current step + progress on the right */}
      <div className="bg-primary text-primary-foreground">
        <div className="max-w-md mx-auto px-5 py-5 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {config.gymLogo ? (
              <img src={config.gymLogo} alt={config.gymName} className="w-11 h-11 rounded-xl object-cover ring-1 ring-white/30" />
            ) : (
              <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center font-bold">
                {config.gymName?.[0] ?? "G"}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wide opacity-80">Join us</p>
              <p className="text-base font-bold truncate">{config.gymName}</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-bold leading-tight">{STEP_TITLES[step]}</p>
            <p className="text-[11px] opacity-80">Step {stepIdx + 1} of {steps.length}</p>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="max-w-md w-full mx-auto px-5 pt-4">
        <div className="flex items-center gap-1.5">
          {steps.map((s, i) => (
            <div key={s} className={cn("h-1.5 flex-1 rounded-full transition-colors", i <= stepIdx ? "bg-primary" : "bg-muted")} />
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 max-w-md w-full mx-auto px-5 py-4 space-y-4">
        {step === "package" && (
          <PackageStep config={config} pick={pick} setPick={setPick} drill={drill} setDrill={setDrill} />
        )}
        {step === "fields" && (
          <MemberSteps memberLimit={memberLimit}>
            {(i) => (
              <FieldsStep
                config={config}
                values={memberFields[i] || {}}
                onChange={(id, v) => setMemberFields((prev) => prev.map((row, idx) => (idx === i ? { ...row, [id]: v } : row)))}
              />
            )}
          </MemberSteps>
        )}
        {step === "photo" && (
          <MemberSteps memberLimit={memberLimit}>
            {(i) => (
              <PhotoStep
                config={config}
                photo={memberPhotos[i] || ""}
                onPhoto={(dataUrl) => setMemberPhotos((prev) => prev.map((p, idx) => (idx === i ? dataUrl : p)))}
              />
            )}
          </MemberSteps>
        )}
        {step === "emergency" && (
          <MemberSteps memberLimit={memberLimit}>
            {(i) => <EmergencyStep config={config} contacts={memberEmergency[i] || [{}]} setContacts={sliceSetter(setMemberEmergency, i)} />}
          </MemberSteps>
        )}
        {step === "questions" && (
          <MemberSteps memberLimit={memberLimit}>
            {(i) => (
              <QuestionsStep
                config={config}
                answers={memberAnswers[i] || {}}
                setAnswers={sliceSetter(setMemberAnswers, i)}
                howHeard={memberHowHeard[i] || ""}
                setHowHeard={(v) => setMemberHowHeard((prev) => prev.map((x, idx) => (idx === i ? v : x)))}
              />
            )}
          </MemberSteps>
        )}
        {step === "agreement" && (
          <MemberSteps memberLimit={memberLimit}>
            {(i) => (
              <AgreementStep
                config={config}
                agreed={!!memberAgreed[i]}
                setAgreed={(v) => setMemberAgreed((prev) => prev.map((x, idx) => (idx === i ? v : x)))}
                signature={memberSignature[i] || ""}
                setSignature={(v) => setMemberSignature((prev) => prev.map((x, idx) => (idx === i ? v : x)))}
              />
            )}
          </MemberSteps>
        )}
      </div>

      {/* Footer nav */}
      <div className="sticky bottom-0 border-t border-border/60 bg-background/90 backdrop-blur">
        <div className="max-w-md mx-auto px-5 py-3 flex items-center gap-3">
          {stepIdx > 0 && (
            <button onClick={onBack} className="h-11 px-4 rounded-xl border border-border text-sm font-semibold text-foreground flex items-center gap-1">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          )}
          <button
            onClick={onContinue}
            disabled={!canContinue || submitting}
            className={cn(
              "h-11 flex-1 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-opacity",
              canContinue && !submitting ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground opacity-70",
            )}
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {isLast ? "Complete Signup" : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center bg-background px-6 text-center">{children}</div>;
}

// A state setter scoped to one member's slice of a per-member array — lets the
// single-member step components stay unchanged.
function sliceSetter<T>(setAll: React.Dispatch<React.SetStateAction<T[]>>, index: number): React.Dispatch<React.SetStateAction<T>> {
  return (action) =>
    setAll((prev) => prev.map((item, i) => (i === index ? (typeof action === "function" ? (action as (p: T) => T)(item) : action) : item)));
}

// Renders a step once per member. For a single member it's transparent; for a
// multi-seat membership each member gets a clearly labelled "Member N of M" card
// so it's never ambiguous whose details are being filled.
function MemberSteps({ memberLimit, children }: { memberLimit: number; children: (i: number) => React.ReactNode }) {
  if (memberLimit <= 1) return <>{children(0)}</>;
  return (
    <div className="space-y-5">
      {Array.from({ length: memberLimit }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-border/70 bg-card/50 overflow-hidden">
          <div className="flex items-center gap-2 px-3.5 py-2.5 bg-primary/5 border-b border-border/60">
            <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">{i + 1}</span>
            <p className="text-sm font-bold">Member {i + 1}</p>
            <span className="text-xs text-muted-foreground ml-auto">of {memberLimit}</span>
          </div>
          <div className="p-3.5">{children(i)}</div>
        </div>
      ))}
    </div>
  );
}

/* ----------------------------- Step: Package ----------------------------- */
function PackageStep({ config, pick, setPick, drill, setDrill }: {
  config: Config;
  pick: SelfSignupPick;
  setPick: (p: SelfSignupPick) => void;
  drill: { kind: "category" | "class" | "pt"; id: string } | null;
  setDrill: (d: { kind: "category" | "class" | "pt"; id: string } | null) => void;
}) {
  const cats = config.packages.categories.filter((c) => c.memberships.length > 0);
  const classes = config.packages.classes;
  const trainers = config.packages.personalTrainings;
  const hasAny = cats.length || classes.length || trainers.length;
  if (!hasAny) return <p className="text-center text-muted-foreground py-10 text-sm">No packages available.</p>;

  const back = (
    <button onClick={() => { setDrill(null); setPick(null); }} className="flex items-center gap-1 text-sm font-semibold text-primary">
      <ChevronLeft className="w-4 h-4" /> Back
    </button>
  );

  if (drill?.kind === "category") {
    const cat = cats.find((c) => c.categoryId === drill.id);
    return (
      <div className="space-y-3">
        <div className="space-y-0.5">
          <div className="flex items-center justify-between gap-2">
            {back}
            <p className="font-bold truncate text-right">{cat?.categoryName}</p>
          </div>
          <p className="text-xs text-muted-foreground text-right">Choose one membership</p>
        </div>
        {(cat?.memberships ?? []).map((m) => (
          <OptionCard key={m._id} title={m.name} sub={[m.duration, m.price ? `Rs ${m.price}` : ""].filter(Boolean).join(" · ")}
            desc={m.description} benefits={m.benefits} selected={pick?.id === m._id}
            onClick={() => setPick(pick?.id === m._id ? null : { kind: "membership", parentId: drill.id, id: m._id })} />
        ))}
      </div>
    );
  }
  if (drill) {
    const parent = (drill.kind === "class" ? classes : trainers).find((p) => p._id === drill.id) as any;
    const subs = drill.kind === "class" ? (parent?.subscriptions ?? []) : trainers.filter((t) => t._id === drill.id);
    return (
      <div className="space-y-3">
        <div className="space-y-0.5">
          <div className="flex items-center justify-between gap-2">
            {back}
            <p className="font-bold truncate text-right">{parent?.name}</p>
          </div>
          <p className="text-xs text-muted-foreground text-right">Choose one subscription</p>
        </div>
        {drill.kind === "class"
          ? (parent?.subscriptions ?? []).map((s: ClassSub) => (
              <OptionCard key={s._id} title={s.name} sub={[s.duration, s.sessions, s.price ? `Rs ${s.price}` : ""].filter(Boolean).join(" · ")}
                selected={pick?.id === s._id}
                onClick={() => setPick(pick?.id === s._id ? null : { kind: "class", parentId: drill.id, id: s._id })} />
            ))
          : (parent ? [parent] : []).map((p: PTPackage) => (
              <OptionCard key={p._id} title={p.name} sub={[p.duration, p.sessions, p.price ? `Rs ${p.price}` : ""].filter(Boolean).join(" · ")}
                desc={p.trainer?.name ? `With ${p.trainer.name}` : undefined}
                selected={pick?.id === p._id}
                onClick={() => setPick(pick?.id === p._id ? null : { kind: "pt", parentId: drill.id, id: p._id })} />
            ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {cats.length > 0 && (
        <Section title="Memberships" hint="Pick 1 only">
          {cats.map((c) => (
            <DrillRow key={c.categoryId} name={c.categoryName} meta={`${c.memberships.length} option${c.memberships.length === 1 ? "" : "s"}`}
              active={pick?.parentId === c.categoryId} onClick={() => setDrill({ kind: "category", id: c.categoryId })} />
          ))}
        </Section>
      )}
      {classes.length > 0 && (
        <Section title="Classes" hint="Tap to view">
          {classes.map((c) => (
            <DrillRow key={c._id} name={c.name} meta={c.meta || "View subscriptions"}
              active={pick?.parentId === c._id} onClick={() => setDrill({ kind: "class", id: c._id })} />
          ))}
        </Section>
      )}
      {trainers.length > 0 && (
        <Section title="Personal Training" hint="Tap to view">
          {trainers.map((t) => (
            <DrillRow key={t._id} name={t.name} meta={t.meta || "View packages"}
              active={pick?.parentId === t._id} onClick={() => setDrill({ kind: "pt", id: t._id })} />
          ))}
        </Section>
      )}
    </div>
  );
}
type SelfSignupPick = { kind: "membership" | "class" | "pt"; parentId: string; id: string } | null;

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</p>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
function DrillRow({ name, meta, active, onClick }: { name: string; meta: string; active?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn("w-full flex items-center justify-between gap-2 rounded-xl border p-3 text-left transition-colors",
      active ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40")}>
      <div className="min-w-0">
        <p className="text-sm font-semibold truncate">{name}</p>
        <p className="text-xs text-muted-foreground truncate">{meta}</p>
      </div>
      {active ? <Check className="w-4 h-4 text-primary shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
    </button>
  );
}
function OptionCard({ title, sub, desc, benefits, selected, onClick }: {
  title: string; sub?: string; desc?: string; benefits?: string[]; selected?: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} className={cn("w-full rounded-xl border p-3.5 text-left transition-colors",
      selected ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border bg-card hover:border-primary/40")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold">{title}</p>
          {sub && <p className="text-xs text-primary font-semibold mt-0.5">{sub}</p>}
          {desc && <p className="text-xs text-muted-foreground mt-1">{desc}</p>}
        </div>
        <div className={cn("w-5 h-5 rounded-full border shrink-0 flex items-center justify-center",
          selected ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40")}>
          {selected && <Check className="w-3 h-3" />}
        </div>
      </div>
      {benefits && benefits.length > 0 && (
        <ul className="mt-2 space-y-1">
          {benefits.slice(0, 4).map((b, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground"><Check className="w-3 h-3 text-primary mt-0.5 shrink-0" />{b}</li>
          ))}
        </ul>
      )}
    </button>
  );
}

/* ----------------------------- Step: Fields ----------------------------- */
function FieldsStep({ config, values, onChange }: {
  config: Config; values: Record<string, string>; onChange: (id: string, v: string) => void;
}) {
  return (
    <div className="space-y-3">
      {config.fields.map((f) => {
        const val = values[f.id] ?? "";
        const label = (
          <label className="text-sm font-semibold flex items-center gap-1">{f.label}{f.required && <span className="text-destructive">*</span>}</label>
        );
        if (f.id === "gender") {
          return (
            <div key={f.id} className="space-y-1.5">
              {label}
              <div className="grid grid-cols-3 gap-2">
                {GENDER_OPTIONS.map((opt) => (
                  <button key={opt} type="button" onClick={() => onChange(f.id, val === opt ? "" : opt)}
                    className={cn("py-2.5 rounded-xl border text-sm font-medium transition-colors",
                      val === opt ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted/30 hover:bg-muted/50")}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          );
        }
        if (f.id === "password") {
          const tooShort = val.length > 0 && val.length < PASSWORD_MIN_LENGTH;
          return (
            <div key={f.id} className="space-y-1.5">
              <label className="text-sm font-semibold flex items-center gap-1">{f.label}<span className="text-destructive">*</span></label>
              <input type="password" value={val} onChange={(e) => onChange(f.id, e.target.value)}
                autoComplete="new-password"
                placeholder={`At least ${PASSWORD_MIN_LENGTH} characters`}
                className={cn("w-full h-11 rounded-xl border bg-background px-3 text-sm", tooShort ? "border-destructive" : "border-border")} />
              <p className={cn("text-xs", tooShort ? "text-destructive" : "text-muted-foreground")}>
                {tooShort
                  ? `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`
                  : `You'll use this to log in to the member app. At least ${PASSWORD_MIN_LENGTH} characters.`}
              </p>
            </div>
          );
        }
        if (f.type === "select") {
          return (
            <div key={f.id} className="space-y-1.5">
              {label}
              <select value={val} onChange={(e) => onChange(f.id, e.target.value)}
                className="w-full h-11 rounded-xl border border-border bg-background px-3 text-sm">
                <option value="">Select</option>
                {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          );
        }
        if (f.type === "textarea") {
          return (
            <div key={f.id} className="space-y-1.5">
              {label}
              <textarea value={val} onChange={(e) => onChange(f.id, e.target.value)} rows={3}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
            </div>
          );
        }
        return (
          <div key={f.id} className="space-y-1.5">
            {label}
            <input type={f.type === "number" ? "number" : f.type === "date" ? "date" : f.type === "email" ? "email" : f.type === "tel" ? "tel" : "text"}
              value={val} onChange={(e) => onChange(f.id, e.target.value)}
              className="w-full h-11 rounded-xl border border-border bg-background px-3 text-sm" />
          </div>
        );
      })}
    </div>
  );
}

/* ----------------------------- Step: Photo ----------------------------- */
function PhotoStep({ config, photo, onPhoto }: {
  config: Config; photo: string; onPhoto: (dataUrl: string) => void;
}) {
  const onFile = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => onPhoto(reader.result as string);
    reader.readAsDataURL(file);
  };
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">Profile photo{config.memberPhoto.required && <span className="text-destructive"> *</span>}</p>
      <label className="block cursor-pointer">
        {photo ? (
          <div className="relative">
            <img src={photo} alt="" className="w-full h-48 object-cover rounded-2xl border border-border" />
            <span className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-lg">Change</span>
          </div>
        ) : (
          <div className="h-40 rounded-2xl border-2 border-dashed border-border bg-muted/30 flex flex-col items-center justify-center gap-1.5 text-muted-foreground">
            <Camera className="w-7 h-7" />
            <span className="text-sm">Tap to add a photo</span>
            <span className="text-xs">{[config.memberPhoto.allowUpload && "Upload", config.memberPhoto.allowCamera && "Camera"].filter(Boolean).join(" · ")}</span>
          </div>
        )}
        <input type="file" accept="image/*" capture={config.memberPhoto.allowCamera ? "user" : undefined}
          className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      </label>
    </div>
  );
}

/* --------------------------- Step: Emergency --------------------------- */
function EmergencyStep({ config, contacts, setContacts }: {
  config: Config; contacts: Record<string, string>[]; setContacts: React.Dispatch<React.SetStateAction<Record<string, string>[]>>;
}) {
  const e = config.emergencyContact;
  const max = e.allowMultiple ? Math.max(1, e.maxContacts || 1) : 1;
  const set = (ci: number, k: string, v: string) => setContacts((prev) => prev.map((c, i) => (i === ci ? { ...c, [k]: v } : c)));
  const rows = [
    { k: "name", label: "Name", req: true, icon: <User className="w-4 h-4" />, show: true },
    { k: "relation", label: "Relationship", req: e.requireRelation, icon: <Users2 className="w-4 h-4" />, show: true, select: true },
    { k: "phone", label: "Phone number", req: e.requirePhone, icon: <Phone className="w-4 h-4" />, show: true },
    { k: "email", label: "Email", req: e.requireEmail, icon: <Mail className="w-4 h-4" />, show: e.showEmail },
    { k: "address", label: "Address", req: e.requireAddress, icon: <MapPin className="w-4 h-4" />, show: e.showAddress },
  ].filter((r) => r.show);

  return (
    <div className="space-y-4">
      {contacts.map((c, ci) => (
        <div key={ci} className="rounded-2xl border border-border bg-card p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wide text-primary">Contact {ci + 1}</p>
            {ci === 0 ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary"><Star className="w-3 h-3" /> Primary</span>
            ) : (
              <button onClick={() => setContacts((prev) => prev.filter((_, i) => i !== ci))} className="text-muted-foreground"><X className="w-4 h-4" /></button>
            )}
          </div>
          {rows.map((r) => (
            <div key={r.k} className="space-y-1.5">
              <label className="text-sm font-semibold flex items-center gap-1.5">{r.icon}{r.label}{r.req && <span className="text-destructive">*</span>}</label>
              {r.select ? (
                <select value={c[r.k] ?? ""} onChange={(ev) => set(ci, r.k, ev.target.value)} className="w-full h-11 rounded-xl border border-border bg-background px-3 text-sm">
                  <option value="">Select</option>
                  {(e.relationshipOptions ?? ["Parent", "Spouse", "Sibling", "Friend"]).map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input value={c[r.k] ?? ""} onChange={(ev) => set(ci, r.k, ev.target.value)} className="w-full h-11 rounded-xl border border-border bg-background px-3 text-sm" />
              )}
            </div>
          ))}
        </div>
      ))}
      {e.allowMultiple && contacts.length < max && (
        <button onClick={() => setContacts((prev) => [...prev, {}])} className="w-full h-11 rounded-xl border border-dashed border-border text-sm font-semibold text-muted-foreground flex items-center justify-center gap-1.5">
          <Plus className="w-4 h-4" /> Add another contact
        </button>
      )}
    </div>
  );
}

/* --------------------------- Step: Questions --------------------------- */
function QuestionsStep({ config, answers, setAnswers, howHeard, setHowHeard }: {
  config: Config; answers: Record<string, any>; setAnswers: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  howHeard: string; setHowHeard: (v: string) => void;
}) {
  const set = (id: string, v: any) => setAnswers((prev) => ({ ...prev, [id]: v }));
  return (
    <div className="space-y-5">
      {config.askHowHeardAboutUs && (
        <div className="space-y-2">
          <label className="text-sm font-semibold flex items-center gap-1">How did you find us?{config.howHeardRequired && <span className="text-destructive">*</span>}</label>
          <div className="grid grid-cols-2 gap-2">
            {HOW_HEARD_OPTIONS.map((o) => {
              const active = howHeard === o.label;
              return (
                <button key={o.label} type="button" onClick={() => setHowHeard(active ? "" : o.label)}
                  className={cn("flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium text-left transition-colors",
                    active ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/30 hover:border-primary/40")}>
                  <span className={active ? "text-primary" : "text-muted-foreground"}>{o.icon}</span>
                  <span className="truncate">{o.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      {config.questions.map((q) => (
        <div key={q.id} className="space-y-1.5">
          <label className="text-sm font-semibold flex items-center gap-1">{q.label}{q.required && <span className="text-destructive">*</span>}</label>
          {q.type === "long_text" ? (
            <textarea rows={3} value={answers[q.id] ?? ""} onChange={(e) => set(q.id, e.target.value)} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
          ) : q.type === "yes_no" ? (
            <div className="grid grid-cols-2 gap-2">
              {["Yes", "No"].map((o) => (
                <button key={o} type="button" onClick={() => set(q.id, o)} className={cn("py-2.5 rounded-xl border text-sm font-medium", answers[q.id] === o ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted/30")}>{o}</button>
              ))}
            </div>
          ) : q.type === "single_choice" ? (
            <div className="space-y-2">
              {(q.options ?? []).map((o) => (
                <button key={o} type="button" onClick={() => set(q.id, o)} className={cn("w-full text-left px-3 py-2.5 rounded-xl border text-sm", answers[q.id] === o ? "border-primary bg-primary/10 text-primary font-medium" : "border-border bg-muted/30")}>{o}</button>
              ))}
            </div>
          ) : q.type === "multi_choice" ? (
            <div className="space-y-2">
              {(q.options ?? []).map((o) => {
                const arr: string[] = Array.isArray(answers[q.id]) ? answers[q.id] : [];
                const on = arr.includes(o);
                return (
                  <button key={o} type="button" onClick={() => set(q.id, on ? arr.filter((x) => x !== o) : [...arr, o])}
                    className={cn("w-full text-left px-3 py-2.5 rounded-xl border text-sm flex items-center gap-2", on ? "border-primary bg-primary/10 text-primary font-medium" : "border-border bg-muted/30")}>
                    <span className={cn("w-4 h-4 rounded border flex items-center justify-center", on ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40")}>{on && <Check className="w-3 h-3" />}</span>
                    {o}
                  </button>
                );
              })}
            </div>
          ) : q.type === "date" ? (
            <input type="date" value={answers[q.id] ?? ""} onChange={(e) => set(q.id, e.target.value)} className="w-full h-11 rounded-xl border border-border bg-background px-3 text-sm" />
          ) : (
            <input value={answers[q.id] ?? ""} onChange={(e) => set(q.id, e.target.value)} className="w-full h-11 rounded-xl border border-border bg-background px-3 text-sm" />
          )}
        </div>
      ))}
    </div>
  );
}

/* --------------------------- Step: Agreement --------------------------- */
function AgreementStep({ config, agreed, setAgreed, signature, setSignature }: {
  config: Config; agreed: boolean; setAgreed: (v: boolean) => void; signature: string; setSignature: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      {config.agreement.enabled && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-border bg-muted/20 p-3.5 space-y-2.5">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground"><ShieldCheck className="w-4 h-4 text-primary" /> Terms & Conditions</div>
            {config.agreement.conditions.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No terms configured.</p>
            ) : (
              <ul className="space-y-2">
                {config.agreement.conditions.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground leading-relaxed"><Check className="w-4 h-4 text-primary mt-0.5 shrink-0" /><span>{c}</span></li>
                ))}
              </ul>
            )}
          </div>
          <button type="button" onClick={() => setAgreed(!agreed)} className="w-full flex items-start gap-2.5 text-left">
            <span className={cn("w-5 h-5 rounded-md border mt-0.5 shrink-0 flex items-center justify-center", agreed ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40")}>{agreed && <Check className="w-3.5 h-3.5" />}</span>
            <span className={cn("text-sm leading-relaxed", agreed ? "text-foreground font-medium" : "text-muted-foreground")}>I have read and agree to all the terms and conditions above.</span>
          </button>
        </div>
      )}
      {config.signature.enabled && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">{config.signature.label || "Signature"}</p>
          <div className="rounded-2xl border border-border overflow-hidden bg-card">
            <SignaturePad onSave={setSignature} existingSignature={signature} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ----------------------------- Welcome screen ----------------------------- */
function WelcomeScreen({ config, members }: { config: Config; members: { memberId?: string; name?: string; phoneNumber?: string; password?: string }[] }) {
  const w = config.welcome || {};
  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/10 via-background to-background flex items-center justify-center px-6 py-10">
      <div className="max-w-md w-full space-y-5">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-3xl bg-primary text-primary-foreground mx-auto flex items-center justify-center shadow-lg">
            <PartyPopper className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{w.title || "Welcome!"}</h1>
            <p className="text-muted-foreground mt-1">{w.message || `You've successfully joined ${config.gymName}.`}</p>
          </div>
        </div>

        {members.length > 0 ? (
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-wide font-semibold text-muted-foreground">Your login details</p>
            {members.map((m, i) => (
              <div key={i} className="rounded-2xl border border-border bg-card overflow-hidden">
                <div className="flex items-center gap-2 px-3.5 py-2 bg-primary/5 border-b border-border/60">
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">{i + 1}</span>
                  <p className="text-sm font-bold">{m.name || `Member ${i + 1}`}</p>
                </div>
                <div className="p-3.5 space-y-2">
                  <KV icon={<IdCard className="w-4 h-4" />} k="Member ID" v={m.memberId || "—"} />
                  {m.phoneNumber && <KV icon={<Phone className="w-4 h-4" />} k="Phone" v={m.phoneNumber} />}
                  {m.password && <KV icon={<KeyRound className="w-4 h-4" />} k="Password" v={m.password} mono />}
                </div>
              </div>
            ))}
            <p className="text-center text-xs text-muted-foreground">Save these to log in to the member app. Keep your password private.</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-4 text-left space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><IdCard className="w-4 h-4" /> Your membership details were sent to the gym.</div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><KeyRound className="w-4 h-4" /> You'll receive your login shortly.</div>
          </div>
        )}
      </div>
    </div>
  );
}

function KV({ icon, k, v, mono }: { icon: React.ReactNode; k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="flex items-center gap-1.5 text-muted-foreground">{icon}{k}</span>
      <span className={cn("font-semibold", mono && "font-mono tracking-wide")}>{v}</span>
    </div>
  );
}
