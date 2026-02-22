import { useState, useMemo, useCallback } from "react";

// ═══════════════════════════════════════════════
// IBC CYCLE DATA
// ═══════════════════════════════════════════════

const IBC_CYCLES = {
  "2003": {
    label: "IBC 2003",
    note: "TEA default for unincorporated areas without adopted codes per §61.1040(j)(1)(A)",
    genderNeutralProvisions: false,
    singleUserContribute: false,
    separateFacilitiesThreshold: 15, // occupant load threshold for separate facilities exception
    urinalSubMax: 0.67,
    dfExemptThreshold: 0, // no DF exemption in 2003
  },
  "2012": {
    label: "IBC 2012",
    note: "Adopted by some smaller Texas municipalities",
    genderNeutralProvisions: false,
    singleUserContribute: true,
    separateFacilitiesThreshold: 15,
    urinalSubMax: 0.67,
    dfExemptThreshold: 0,
  },
  "2015": {
    label: "IBC 2015",
    note: "Common in mid-size Texas cities",
    genderNeutralProvisions: false,
    singleUserContribute: true,
    separateFacilitiesThreshold: 15,
    urinalSubMax: 0.67,
    dfExemptThreshold: 15,
  },
  "2018": {
    label: "IBC 2018",
    note: "Widely adopted across Texas municipalities",
    genderNeutralProvisions: false,
    singleUserContribute: true,
    separateFacilitiesThreshold: 15,
    urinalSubMax: 0.67,
    dfExemptThreshold: 15,
  },
  "2021": {
    label: "IBC 2021",
    note: "Current model code — includes multi-user gender-neutral provisions",
    genderNeutralProvisions: true,
    singleUserContribute: true,
    separateFacilitiesThreshold: 15,
    urinalSubMax: 0.67,
    dfExemptThreshold: 30,
  },
  "2024": {
    label: "IBC 2024",
    note: "Latest cycle — expanded gender-neutral/all-gender facility language",
    genderNeutralProvisions: true,
    singleUserContribute: true,
    separateFacilitiesThreshold: 15,
    urinalSubMax: 0.67,
    dfExemptThreshold: 30,
  },
};

// ═══════════════════════════════════════════════
// TEA & SPACE DATA
// ═══════════════════════════════════════════════

const TEA_LIMITS = {
  elementary: { defaultClassSize: 22, maxClassSize: 22, scienceMaxClassSize: 25, label: "Elementary (PK–5)" },
  middle: { defaultClassSize: 25, maxClassSize: 25, scienceMaxClassSize: 28, label: "Middle School (6–8)" },
  high: { defaultClassSize: 25, maxClassSize: 25, scienceMaxClassSize: 28, label: "High School (9–12)" },
};

const FLEXIBILITY_LEVELS = [
  { id: "L1", label: "Level 1", desc: "Fixed teacher presentation, attached desk/chairs, teacher-centric, minimal flexibility" },
  { id: "L2", label: "Level 2", desc: "Fixed presentation, detached furniture, moderate digital access, limited outdoor visibility" },
  { id: "L3", label: "Level 3", desc: "Multiple presentation spaces, flexible mobile furniture, high digital access, outdoor proximity" },
  { id: "L4", label: "Level 4", desc: "Mobile presentation spaces, direct outdoor access, reconfigurable walls, anytime/anywhere philosophy" },
];

const SF_PER_STUDENT = {
  elementary: { L1: 36, L2: 36, L3: 42, L4: 42 },
  middle: { L1: 32, L2: 32, L3: 36, L4: 36 },
  high: { L1: 32, L2: 32, L3: 36, L4: 36 },
};

const GYM_SF = { elementary: 3000, middle: 4800, high: 7500 };
const SCIENCE_SF = { elementary: { combo: 50 }, middle: { combo: 58, separateLab: 42 }, high: { combo: 58, separateLab: 42 } };
const SPED_SF_PER_STUDENT = 45;
const PLUMBING = { wcRatio: 50, lavRatio: 50, dfRatio: 100 };
const RR_SF = { wcStall: 35, wcAccessible: 65, urinal: 15, lavatory: 12, circulation: 1.35 };
const STAFF_RATIO = { elementary: 0.10, middle: 0.08, high: 0.07 };
const SUPPORT_BENCHMARKS = {
  elementary: { admin: 2.5, teacherWork: 1.5, cafeteria: 12, custodial: 0.8, mechanical: 3.0 },
  middle: { admin: 2.0, teacherWork: 1.2, cafeteria: 10, custodial: 0.7, mechanical: 2.8 },
  high: { admin: 1.8, teacherWork: 1.0, cafeteria: 9, custodial: 0.6, mechanical: 2.5 },
};
const NET_TO_GROSS = { elementary: 1.35, middle: 1.38, high: 1.40 };
const DEFAULT_ADVANCED = {
  elementary: { periodsPerDay: 1, utilization: 0.85, spedPct: 0.12, spedRoomCap: 12, scienceConfig: "combo", electiveRooms: 2 },
  middle: { periodsPerDay: 7, utilization: 0.85, spedPct: 0.12, spedRoomCap: 12, scienceConfig: "combo", electiveRooms: 4 },
  high: { periodsPerDay: 7, utilization: 0.80, spedPct: 0.12, spedRoomCap: 12, scienceConfig: "combo", electiveRooms: 6 },
};

function calcLibrarySF(students) {
  if (students <= 100) return 1400;
  if (students <= 500) return 1400 + 4 * (students - 100);
  if (students <= 2000) return 3000 + 3 * (students - 500);
  return 7500 + 2 * (students - 2000);
}

function calcPlumbing(studentCount, staffCount, ibcCycle) {
  const ibc = IBC_CYCLES[ibcCycle];
  const studentPerSex = Math.ceil(studentCount / 2);
  const staffPerSex = Math.ceil(staffCount / 2);
  const totalOccupants = studentCount + staffCount;

  const studentWC_male = Math.ceil(studentPerSex / PLUMBING.wcRatio);
  const studentWC_female = Math.ceil(studentPerSex / PLUMBING.wcRatio);
  const studentLav_male = Math.ceil(studentPerSex / PLUMBING.lavRatio);
  const studentLav_female = Math.ceil(studentPerSex / PLUMBING.lavRatio);

  const staffWC_male = staffPerSex <= 25 ? Math.ceil(staffPerSex / 25) : 1 + Math.ceil((staffPerSex - 25) / 50);
  const staffWC_female = staffPerSex <= 25 ? Math.ceil(staffPerSex / 25) : 1 + Math.ceil((staffPerSex - 25) / 50);
  const staffLav_male = staffPerSex <= 40 ? Math.ceil(staffPerSex / 40) : 1 + Math.ceil((staffPerSex - 40) / 80);
  const staffLav_female = staffPerSex <= 40 ? Math.ceil(staffPerSex / 40) : 1 + Math.ceil((staffPerSex - 40) / 80);

  const drinkingFountains = totalOccupants <= ibc.dfExemptThreshold ? 0 : Math.ceil(totalOccupants / PLUMBING.dfRatio);
  const studentClusters = Math.max(2, Math.ceil(studentCount / 250));
  const staffClusters = Math.max(1, Math.ceil(staffCount / 40));

  const studentRR_SF = calcRestroomSF(studentWC_male, studentWC_female, studentLav_male, studentLav_female, studentClusters, ibc.urinalSubMax, true);
  const staffRR_SF = calcRestroomSF(staffWC_male, staffWC_female, staffLav_male, staffLav_female, staffClusters, Math.min(ibc.urinalSubMax, 0.5), false);

  return {
    student: { wc_male: studentWC_male, wc_female: studentWC_female, lav_male: studentLav_male, lav_female: studentLav_female, clusters: studentClusters, sf: studentRR_SF },
    staff: { wc_male: staffWC_male, wc_female: staffWC_female, lav_male: staffLav_male, lav_female: staffLav_female, clusters: staffClusters, sf: staffRR_SF },
    drinkingFountains, totalSF: studentRR_SF + staffRR_SF,
    genderNeutral: ibc.genderNeutralProvisions,
  };
}

function calcRestroomSF(wcM, wcF, lavM, lavF, clusters, urinalMax, isStudent) {
  const wcPerClusterM = Math.ceil(wcM / clusters);
  const wcPerClusterF = Math.ceil(wcF / clusters);
  const lavPerClusterM = Math.ceil(lavM / clusters);
  const lavPerClusterF = Math.ceil(lavF / clusters);
  let sf = 0;
  const accessibleM = 1;
  const standardM = Math.max(0, wcPerClusterM - accessibleM);
  const urinalsM = Math.floor(wcPerClusterM * urinalMax);
  sf += (accessibleM * RR_SF.wcAccessible) + (standardM * RR_SF.wcStall) + (urinalsM * RR_SF.urinal) + (lavPerClusterM * RR_SF.lavatory);
  const accessibleF = 1;
  const standardF = Math.max(0, wcPerClusterF - accessibleF);
  sf += (accessibleF * RR_SF.wcAccessible) + (standardF * RR_SF.wcStall) + (lavPerClusterF * RR_SF.lavatory);
  return Math.ceil(sf * RR_SF.circulation * clusters);
}

function calculate(campusType, studentCount, flexLevel, classSize, advanced, complianceMethod, cafeteriaAsInstructional, ibcCycle) {
  const sfPerStudent = SF_PER_STUDENT[campusType][flexLevel];
  const scienceMax = TEA_LIMITS[campusType].scienceMaxClassSize;
  const staffCount = Math.ceil(studentCount * STAFF_RATIO[campusType]);
  const r = { rooms: [], librarySF: 0, gymSF: 0, totalInstructionalSF: 0, aggregateSF: 0, support: [], totalSupportSF: 0, plumbing: null, netSF: 0, grossFactor: NET_TO_GROSS[campusType], staffCount, cafeteriaSF: 0, cafeteriaInstructionalCredit: 0 };
  if (!studentCount || studentCount <= 0) return r;
  const { periodsPerDay, utilization, spedPct, spedRoomCap, scienceConfig, electiveRooms } = advanced;

  if (campusType === "elementary") {
    const homerooms = Math.ceil(studentCount / classSize);
    r.rooms.push({ type: "General Classrooms (Homerooms)", count: homerooms, sfPerRoom: classSize * sfPerStudent, sfPerStudentUsed: sfPerStudent, maxStudents: classSize, note: "Self-contained homerooms", code: "§61.1040(h)(1)(A)" });
    const scienceRooms = Math.ceil(homerooms / 3);
    r.rooms.push({ type: "Science Combo Classroom/Labs", count: scienceRooms, sfPerRoom: scienceMax * SCIENCE_SF.elementary.combo, sfPerStudentUsed: SCIENCE_SF.elementary.combo, maxStudents: scienceMax, note: `${SCIENCE_SF.elementary.combo} SF/student, max ${scienceMax}`, code: "§61.1040(g)(2)(A)(i)" });
    r.rooms.push({ type: "Elective Rooms (Art, Music, etc.)", count: electiveRooms, sfPerRoom: classSize * sfPerStudent, sfPerStudentUsed: sfPerStudent, maxStudents: classSize, note: "Specials rotation rooms", code: "§61.1040(h)(1)(F)" });
  } else {
    const sectionsPerSubject = Math.ceil(studentCount / classSize);
    const roomsPerSubject = Math.ceil(sectionsPerSubject / (periodsPerDay * utilization));
    ["Math Classrooms", "ELA Classrooms", "Social Studies Classrooms"].forEach((subj) => {
      r.rooms.push({ type: subj, count: roomsPerSubject, sfPerRoom: classSize * sfPerStudent, sfPerStudentUsed: sfPerStudent, maxStudents: classSize, note: `${sectionsPerSubject} sec. ÷ (${periodsPerDay} per. × ${(utilization * 100).toFixed(0)}% util.)`, code: "§61.1040(h)(1)(A)" });
    });
    const sciRooms = Math.ceil(sectionsPerSubject / (periodsPerDay * utilization));
    if (scienceConfig === "combo") {
      r.rooms.push({ type: "Science Combo Classroom/Labs", count: sciRooms, sfPerRoom: scienceMax * SCIENCE_SF[campusType].combo, sfPerStudentUsed: SCIENCE_SF[campusType].combo, maxStudents: scienceMax, note: `${SCIENCE_SF[campusType].combo} SF/student, max ${scienceMax}`, code: "§61.1040(g)(2)(A)" });
    } else {
      r.rooms.push({ type: "Science Laboratories", count: sciRooms, sfPerRoom: scienceMax * SCIENCE_SF[campusType].separateLab, sfPerStudentUsed: SCIENCE_SF[campusType].separateLab, maxStudents: scienceMax, note: `${SCIENCE_SF[campusType].separateLab} SF/student, max ${scienceMax}`, code: "§61.1040(g)(2)(B)" });
      r.rooms.push({ type: "Science Classrooms (paired)", count: sciRooms * 2, sfPerRoom: classSize * sfPerStudent, sfPerStudentUsed: sfPerStudent, maxStudents: classSize, note: "2:1 classroom-to-lab ratio max", code: "§61.1040(g)(2)(C)" });
    }
    r.rooms.push({ type: "Elective Rooms (CTE, Fine Arts, etc.)", count: electiveRooms, sfPerRoom: classSize * sfPerStudent, sfPerStudentUsed: sfPerStudent, maxStudents: classSize, note: "User-defined elective spaces", code: "§61.1040(h)(1)(F)" });
  }

  const spedStudents = Math.ceil(studentCount * spedPct);
  const spedRooms = Math.max(1, Math.ceil(spedStudents / spedRoomCap));
  r.rooms.push({ type: "Special Education Classrooms", count: spedRooms, sfPerRoom: spedRoomCap * SPED_SF_PER_STUDENT, sfPerStudentUsed: SPED_SF_PER_STUDENT, maxStudents: spedRoomCap, note: `${spedStudents} SpEd (${(spedPct * 100).toFixed(0)}%), 45 SF/student min`, code: "§61.1040(g)(2)(K)" });

  r.librarySF = calcLibrarySF(studentCount);
  r.gymSF = GYM_SF[campusType];
  let roomSF = 0;
  r.rooms.forEach((rm) => { roomSF += rm.count * rm.sfPerRoom; });
  r.totalInstructionalSF = roomSF;
  r.aggregateSF = studentCount * sfPerStudent;

  const bench = SUPPORT_BENCHMARKS[campusType];
  r.cafeteriaSF = Math.ceil(studentCount * bench.cafeteria);
  if (complianceMethod === "qualitative" && cafeteriaAsInstructional) {
    r.cafeteriaInstructionalCredit = Math.ceil(r.cafeteriaSF * 0.5);
    r.totalInstructionalSF += r.cafeteriaInstructionalCredit;
  }

  r.support.push({ type: "Administration & Front Office", sf: Math.ceil(studentCount * bench.admin), note: "Principal, AP, registrar, counselors, nurse, reception, conference", code: "District Ed. Specs." });
  r.support.push({ type: "Teacher Workrooms & Lounges", sf: Math.ceil(studentCount * bench.teacherWork), note: `${staffCount} staff — planning rooms, workrooms, break areas`, code: "District Ed. Specs." });
  r.support.push({ type: "Cafeteria / Kitchen / Serving", sf: r.cafeteriaSF, note: "Kitchen, serving lines, dining (~1/3 student body per lunch)", code: complianceMethod === "qualitative" && cafeteriaAsInstructional ? "§61.1040(i)(2)" : "Non-instructional" });
  r.support.push({ type: "Custodial & Storage", sf: Math.ceil(studentCount * bench.custodial), note: "Custodial closets, receiving dock, central/IT storage", code: "IBC / District Std." });
  r.support.push({ type: "Mechanical / Electrical / Telecom", sf: Math.ceil(studentCount * bench.mechanical), note: "HVAC, electrical rooms, MDF/IDF, fire riser", code: `IBC ${ibcCycle} / IMC` });

  r.plumbing = calcPlumbing(studentCount, staffCount, ibcCycle);
  r.support.push({ type: "Student Restrooms", sf: r.plumbing.student.sf, note: `${r.plumbing.student.clusters} clusters · ${r.plumbing.student.wc_male}M/${r.plumbing.student.wc_female}F WC · TAS accessible`, code: `IBC ${ibcCycle} §2902.1 / TAS` });
  r.support.push({ type: "Staff Restrooms", sf: r.plumbing.staff.sf, note: `${r.plumbing.staff.clusters} cluster(s) · ${r.plumbing.staff.wc_male}M/${r.plumbing.staff.wc_female}F WC · Separate`, code: `IBC ${ibcCycle} §2902.1 / TAS` });

  r.totalSupportSF = r.support.reduce((sum, s) => sum + s.sf, 0);
  r.netSF = r.totalInstructionalSF + r.librarySF + r.gymSF + r.totalSupportSF;
  return r;
}

// ═══════════════════════════════════════════════
// UI
// ═══════════════════════════════════════════════

const C = { bg: "#0C0F14", surface: "#141820", border: "#232A36", accent: "#D4A053", accentDim: "#8B6D3F", accentBright: "#E8B86D", text: "#E8E4DD", textDim: "#8A8680", textMid: "#B5B0A8", red: "#C45C5C", green: "#5CA06C", blue: "#5C8AB4", purple: "#9B7EC8" };

// Responsive typography scale (see typography.css); use TYPO.* in fontSize for fluid mobile→desktop scaling
const TYPO = {
  caption: "var(--font-size-caption)",
  xs: "var(--font-size-xs)",
  sm: "var(--font-size-sm)",
  body: "var(--font-size-body)",
  bodyLg: "var(--font-size-bodyLg)",
  md: "var(--font-size-md)",
  lg: "var(--font-size-lg)",
  xl: "var(--font-size-xl)",
  card: "var(--font-size-card)",
  display: "var(--font-size-display)",
  h1: "var(--font-size-h1)",
  icon: "var(--font-size-icon)",
};

function fmt(n) { return n.toLocaleString("en-US"); }
function CodeTag({ children, dim }) {
  return <span style={{ fontSize: TYPO.caption, fontFamily: "'DM Mono', monospace", color: dim ? `${C.textDim}90` : C.accentDim, background: dim ? `${C.text}08` : `${C.accent}10`, padding: "2px 6px", borderRadius: 3, fontWeight: 500 }}>{children}</span>;
}

export default function TEACalculator() {
  const [campusType, setCampusType] = useState("elementary");
  const [studentCount, setStudentCount] = useState(750);
  const [flexLevel, setFlexLevel] = useState("L2");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [classSize, setClassSize] = useState(null);
  const [advanced, setAdvanced] = useState({ ...DEFAULT_ADVANCED.elementary });
  const [complianceMethod, setComplianceMethod] = useState("quantitative");
  const [cafeteriaAsInstructional, setCafeteriaAsInstructional] = useState(false);
  const [grossOverride, setGrossOverride] = useState(null);
  const [ibcCycle, setIbcCycle] = useState("2021");

  const handleCampusChange = useCallback((type) => { setCampusType(type); setClassSize(null); setAdvanced({ ...DEFAULT_ADVANCED[type] }); setCafeteriaAsInstructional(false); }, []);
  const effectiveClassSize = classSize !== null ? classSize : TEA_LIMITS[campusType].defaultClassSize;
  const maxAllowed = TEA_LIMITS[campusType].maxClassSize;
  const handleClassSizeChange = (val) => { const n = parseInt(val, 10); if (isNaN(n)) { setClassSize(null); return; } setClassSize(Math.min(Math.max(1, n), maxAllowed)); };
  const updateAdv = (key, val) => setAdvanced((prev) => ({ ...prev, [key]: val }));
  const effectiveGross = grossOverride !== null ? grossOverride : NET_TO_GROSS[campusType];

  const results = useMemo(() => calculate(campusType, studentCount, flexLevel, effectiveClassSize, advanced, complianceMethod, cafeteriaAsInstructional, ibcCycle), [campusType, studentCount, flexLevel, effectiveClassSize, advanced, complianceMethod, cafeteriaAsInstructional, ibcCycle]);

  const finalGrossSF = Math.ceil(results.netSF * effectiveGross);
  const meetsAggregate = results.totalInstructionalSF >= results.aggregateSF;
  const sfpp = SF_PER_STUDENT[campusType][flexLevel];
  const ibc = IBC_CYCLES[ibcCycle];

  // Shared styles
  const inp = { width: "100%", padding: "10px 12px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, fontSize: TYPO.lg, fontFamily: "'DM Mono', monospace", outline: "none", boxSizing: "border-box" };
  const sel = { ...inp, fontFamily: "'DM Sans', sans-serif", appearance: "none", cursor: "pointer" };
  const lbl = { display: "block", fontSize: TYPO.sm, fontWeight: 600, color: C.textMid, marginBottom: 6 };
  const card = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "20px 24px", marginBottom: 16 };
  const secL = { fontSize: TYPO.xs, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: C.textDim, marginBottom: 12, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" };
  const rC = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden", marginBottom: 16 };
  const rH = { padding: "14px 24px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 };
  const rHL = { fontSize: TYPO.xs, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: C.textDim };
  const th = { textAlign: "left", padding: "10px 16px", fontSize: TYPO.xs, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: C.textDim, borderBottom: `1px solid ${C.border}`, background: C.bg };
  const thR = { ...th, textAlign: "right" };
  const td = { padding: "10px 16px", borderBottom: `1px solid ${C.border}`, color: C.text, fontSize: TYPO.bodyLg };
  const tdR = { ...td, textAlign: "right", fontFamily: "'DM Mono', monospace" };
  const tdN = { ...td, color: C.textDim, fontSize: TYPO.sm, maxWidth: 280 };
  const tdC = { ...td, fontSize: TYPO.caption, fontFamily: "'DM Mono', monospace", color: `${C.textDim}90` };
  const chip = (on) => ({ flex: 1, padding: "10px 12px", background: on ? `${C.accent}15` : C.bg, border: `1px solid ${on ? C.accent : C.border}`, borderRadius: 6, cursor: "pointer", textAlign: "center", transition: "all .15s", minWidth: 100 });
  const radio = (on) => ({ padding: "8px 14px", background: on ? `${C.accent}15` : C.bg, border: `1px solid ${on ? C.accent : C.border}`, borderRadius: 6, cursor: "pointer", fontSize: TYPO.body, fontWeight: 600, color: on ? C.accent : C.textDim, fontFamily: "'DM Sans', sans-serif", transition: "all .15s" });

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: "100vh", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", padding: 0 }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* HEADER */}
      <div style={{ borderBottom: `1px solid ${C.border}`, padding: "28px 32px 24px", background: `linear-gradient(180deg, ${C.surface} 0%, ${C.bg} 100%)` }}>
        <div style={{ fontSize: TYPO.xs, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: C.accent, marginBottom: 6 }}>TEA §61.1040 — New Construction</div>
        <h1 style={{ fontSize: TYPO.h1, fontWeight: 700, color: C.text, margin: 0, lineHeight: 1.3 }}>School Facility Space Calculator</h1>
        <div style={{ fontSize: TYPO.body, color: C.textDim, marginTop: 6, lineHeight: 1.5 }}>TAC Title 19, Part 2, Ch. 61, Subchapter CC · {ibc.label} · Texas Accessibility Standards</div>
      </div>

      <div style={{ padding: "24px 32px 80px", maxWidth: 960 }}>

        {/* DESIGN CRITERIA */}
        <div style={secL}>Design Criteria <CodeTag dim>§61.1040(d)(2)</CodeTag></div>
        <div style={card}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <label style={lbl}>Campus Type <CodeTag dim>§61.1040(a)(29)</CodeTag></label>
              <select style={sel} value={campusType} onChange={(e) => handleCampusChange(e.target.value)}>
                {Object.entries(TEA_LIMITS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 180 }}>
              <label style={lbl}>Max Instructional Capacity <CodeTag dim>§61.1040(a)(15)</CodeTag></label>
              <input style={inp} type="number" min={1} max={5000} value={studentCount} onChange={(e) => setStudentCount(Math.max(0, parseInt(e.target.value, 10) || 0))} />
            </div>
            <div style={{ flex: 1, minWidth: 180 }}>
              <label style={lbl}>Class Size <span style={{ color: C.textDim, fontWeight: 400 }}>(max {maxAllowed})</span> <CodeTag dim>TEC §25.112</CodeTag></label>
              <input style={inp} type="number" min={1} max={maxAllowed} value={classSize !== null ? classSize : effectiveClassSize} onChange={(e) => handleClassSizeChange(e.target.value)} />
            </div>
          </div>
        </div>

        {/* IBC CYCLE + COMPLIANCE */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={secL}>Adopted Building Code <CodeTag dim>§61.1040(j)(1)</CodeTag></div>
            <div style={{ ...card }}>
              <label style={lbl}>IBC Code Cycle</label>
              <select style={sel} value={ibcCycle} onChange={(e) => setIbcCycle(e.target.value)}>
                {Object.entries(IBC_CYCLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <div style={{ fontSize: TYPO.xs, color: C.textDim, marginTop: 8, lineHeight: 1.5 }}>{ibc.note}</div>
              {ibc.genderNeutralProvisions && (
                <div style={{ marginTop: 8, fontSize: TYPO.xs, color: C.blue, background: `${C.blue}10`, padding: "6px 10px", borderRadius: 4, lineHeight: 1.5 }}>
                  ℹ This cycle includes multi-user gender-neutral facility provisions (§2902.1.2). All-gender restrooms may satisfy fixture requirements when privacy partitions comply with IPC §405.3.4.
                </div>
              )}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={secL}>Compliance Method <CodeTag dim>§61.1040(h) / §61.1040(i)</CodeTag></div>
            <div style={{ ...card }}>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={radio(complianceMethod === "quantitative")} onClick={() => { setComplianceMethod("quantitative"); setCafeteriaAsInstructional(false); }}>Quantitative (Default)</div>
                <div style={radio(complianceMethod === "qualitative")} onClick={() => setComplianceMethod("qualitative")}>Qualitative</div>
              </div>
              {complianceMethod === "qualitative" && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <input type="checkbox" style={{ width: 16, height: 16, accentColor: C.accent, cursor: "pointer" }} checked={cafeteriaAsInstructional} onChange={(e) => setCafeteriaAsInstructional(e.target.checked)} />
                    <span style={{ fontSize: TYPO.body, color: C.textMid }}>Cafeteria instructional credit <CodeTag dim>§61.1040(i)(2)</CodeTag></span>
                  </div>
                  <div style={{ fontSize: TYPO.xs, color: C.textDim, marginLeft: 26, marginTop: 4, lineHeight: 1.5 }}>0.5 factor for ≤50% instructional use. Requires board-approved innovative practices.</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* FLEXIBILITY */}
        <div style={secL}>Flexibility Level <CodeTag dim>§61.1040(h)(2)(A–D)</CodeTag></div>
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          {FLEXIBILITY_LEVELS.map((fl) => (
            <div key={fl.id} style={chip(flexLevel === fl.id)} onClick={() => setFlexLevel(fl.id)}>
              <div style={{ fontSize: TYPO.bodyLg, fontWeight: 700, color: flexLevel === fl.id ? C.accent : C.textMid, marginBottom: 2 }}>{fl.label}</div>
              <div style={{ fontSize: TYPO.xs, color: C.textDim, lineHeight: 1.4 }}>{fl.desc}</div>
            </div>
          ))}
        </div>

        {/* ADVANCED */}
        <button style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "12px 0", border: "none", background: "none", color: C.textDim, fontSize: TYPO.sm, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif" }} onClick={() => setShowAdvanced(!showAdvanced)}>
          <span style={{ fontSize: TYPO.lg, transform: showAdvanced ? "rotate(90deg)" : "rotate(0deg)", display: "inline-block", transition: "transform .15s" }}>▸</span>
          Advanced Parameters
        </button>
        {showAdvanced && (
          <div style={card}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16 }}>
              {campusType !== "elementary" && <div><label style={lbl}>Periods / Day</label><input style={inp} type="number" min={1} max={12} value={advanced.periodsPerDay} onChange={(e) => updateAdv("periodsPerDay", Math.max(1, parseInt(e.target.value, 10) || 7))} /></div>}
              <div><label style={lbl}>Utilization Factor</label><input style={inp} type="number" min={0.5} max={1} step={0.05} value={advanced.utilization} onChange={(e) => updateAdv("utilization", Math.min(1, Math.max(0.5, parseFloat(e.target.value) || 0.85)))} /></div>
              <div><label style={lbl}>SpEd % Enrollment</label><input style={inp} type="number" min={0} max={0.5} step={0.01} value={advanced.spedPct} onChange={(e) => updateAdv("spedPct", Math.min(0.5, Math.max(0, parseFloat(e.target.value) || 0.12)))} /></div>
              <div><label style={lbl}>SpEd Room Capacity</label><input style={inp} type="number" min={1} max={20} value={advanced.spedRoomCap} onChange={(e) => updateAdv("spedRoomCap", Math.max(1, parseInt(e.target.value, 10) || 12))} /></div>
              <div><label style={lbl}>Elective Rooms</label><input style={inp} type="number" min={0} max={30} value={advanced.electiveRooms} onChange={(e) => updateAdv("electiveRooms", Math.max(0, parseInt(e.target.value, 10) || 0))} /></div>
              {campusType !== "elementary" && <div><label style={lbl}>Science Config <CodeTag dim>§61.1040(g)(2)</CodeTag></label><div style={{ display: "flex", gap: 8 }}><div style={radio(advanced.scienceConfig === "combo")} onClick={() => updateAdv("scienceConfig", "combo")}>Combo</div><div style={radio(advanced.scienceConfig === "separate")} onClick={() => updateAdv("scienceConfig", "separate")}>Separate</div></div></div>}
              <div><label style={lbl}>Net-to-Gross Factor</label><input style={inp} type="number" min={1.1} max={1.7} step={0.01} value={grossOverride !== null ? grossOverride : NET_TO_GROSS[campusType]} onChange={(e) => { const v = parseFloat(e.target.value); setGrossOverride(isNaN(v) ? null : Math.min(1.7, Math.max(1.1, v))); }} /></div>
            </div>
          </div>
        )}

        {/* ═══════════ RESULTS ═══════════ */}
        {studentCount > 0 && (<>
          <div style={{ ...secL, marginTop: 24 }}>Project Summary</div>
          <div style={rC}>
            <div style={rH}><span style={rHL}>Space Summary</span><CodeTag>{complianceMethod === "quantitative" ? "§61.1040(h)" : "§61.1040(i)"} + {ibc.label}</CodeTag></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 12, padding: "16px 24px 20px" }}>
              {[["Instructional SF", results.totalInstructionalSF], ["Library SF", results.librarySF], ["Gymnasium SF", results.gymSF], ["Support SF", results.totalSupportSF], ["Total Net SF", results.netSF]].map(([l, v], i) => (
                <div key={i} style={{ padding: "14px 16px", background: C.bg, borderRadius: 6, border: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: TYPO.xs, fontWeight: 600, color: C.textDim, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>{l}</div>
                  <div style={{ fontSize: TYPO.card, fontWeight: 700, color: C.text, fontFamily: "'DM Mono', monospace" }}>{fmt(v)}</div>
                </div>
              ))}
              <div style={{ padding: "14px 16px", background: C.bg, borderRadius: 6, border: `1px solid ${C.accent}40` }}>
                <div style={{ fontSize: TYPO.xs, fontWeight: 600, color: C.accent, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>Gross SF (×{effectiveGross.toFixed(2)})</div>
                <div style={{ fontSize: TYPO.display, fontWeight: 700, color: C.accentBright, fontFamily: "'DM Mono', monospace" }}>{fmt(finalGrossSF)}</div>
              </div>
            </div>
            <div style={{ margin: "0 24px 12px", padding: "12px 16px", borderRadius: 6, display: "flex", alignItems: "center", gap: 10, fontSize: TYPO.body, fontWeight: 600, background: meetsAggregate ? `${C.green}15` : `${C.red}15`, border: `1px solid ${meetsAggregate ? C.green : C.red}30`, color: meetsAggregate ? C.green : C.red }}>
              <span style={{ fontSize: TYPO.icon }}>{meetsAggregate ? "✓" : "✗"}</span>
              <span>Aggregate: {fmt(results.aggregateSF)} SF ({sfpp} SF/pp × {fmt(studentCount)}){meetsAggregate ? ` — +${fmt(results.totalInstructionalSF - results.aggregateSF)} SF` : ` — ${fmt(results.aggregateSF - results.totalInstructionalSF)} SF short`}</span>
            </div>
            {cafeteriaAsInstructional && results.cafeteriaInstructionalCredit > 0 && (
              <div style={{ margin: "0 24px 16px", padding: "10px 16px", borderRadius: 6, background: `${C.blue}10`, border: `1px solid ${C.blue}25`, fontSize: TYPO.sm, color: C.blue }}>ℹ Cafeteria credit: {fmt(results.cafeteriaInstructionalCredit)} SF at 0.5 factor · §61.1040(i)(2)</div>
            )}
          </div>

          {/* SECTION 1 */}
          <div style={secL}>Section 1 — Instructional Spaces <CodeTag>§61.1040(g)–(h)</CodeTag></div>
          <div style={rC}>
            <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: TYPO.bodyLg }}>
              <thead><tr><th style={th}>Space Type</th><th style={thR}>Qty</th><th style={thR}>SF/Room</th><th style={thR}>SF/Stud.</th><th style={thR}>Total SF</th><th style={th}>Notes</th><th style={th}>Code</th></tr></thead>
              <tbody>
                {results.rooms.map((rm, i) => <tr key={i} style={{ background: i % 2 ? `${C.bg}50` : "transparent" }}><td style={td}>{rm.type}</td><td style={tdR}>{rm.count}</td><td style={tdR}>{fmt(rm.sfPerRoom)}</td><td style={tdR}>{rm.sfPerStudentUsed}</td><td style={tdR}>{fmt(rm.count * rm.sfPerRoom)}</td><td style={tdN}>{rm.note}</td><td style={tdC}>{rm.code}</td></tr>)}
                <tr><td style={td}>Library</td><td style={tdR}>—</td><td style={tdR}>{fmt(results.librarySF)}</td><td style={tdR}>—</td><td style={tdR}>{fmt(results.librarySF)}</td><td style={tdN}>Scaled by enrollment</td><td style={tdC}>§61.1040(g)(1)(A)</td></tr>
                <tr><td style={td}>Gymnasium / PE</td><td style={tdR}>—</td><td style={tdR}>{fmt(results.gymSF)}</td><td style={tdR}>—</td><td style={tdR}>{fmt(results.gymSF)}</td><td style={tdN}>Minimum by campus type</td><td style={tdC}>§61.1040(g)(1)(B)</td></tr>
                {cafeteriaAsInstructional && results.cafeteriaInstructionalCredit > 0 && <tr style={{ background: `${C.blue}08` }}><td style={td}>Cafeteria Credit</td><td style={tdR}>—</td><td style={tdR}>—</td><td style={tdR}>×0.5</td><td style={tdR}>{fmt(results.cafeteriaInstructionalCredit)}</td><td style={tdN}>Qualitative only</td><td style={tdC}>§61.1040(i)(2)</td></tr>}
                <tr style={{ background: `${C.blue}08` }}><td style={{ padding: "12px 16px", fontWeight: 700, color: C.blue, fontSize: TYPO.body }} colSpan={4}>INSTRUCTIONAL SUBTOTAL</td><td style={{ padding: "12px 16px", fontWeight: 700, color: C.blue, fontSize: TYPO.lg, textAlign: "right", fontFamily: "'DM Mono', monospace" }}>{fmt(results.totalInstructionalSF + results.librarySF + results.gymSF)}</td><td colSpan={2}></td></tr>
              </tbody>
            </table>
            </div>
          </div>

          {/* SECTION 2 */}
          <div style={secL}>Section 2 — Support & Service Spaces <CodeTag dim>{ibc.label} / TAS / District Std.</CodeTag></div>
          <div style={rC}>
            <div style={rH}><span style={rHL}>Administrative, Service & Mechanical</span><span style={{ fontSize: TYPO.xs, color: C.textDim }}>Staff: {results.staffCount} ({(STAFF_RATIO[campusType] * 100).toFixed(0)}%)</span></div>
            <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: TYPO.bodyLg }}>
              <thead><tr><th style={th}>Space Type</th><th style={thR}>Total SF</th><th style={th}>Notes</th><th style={th}>Code</th></tr></thead>
              <tbody>
                {results.support.map((s, i) => <tr key={i} style={{ background: i % 2 ? `${C.bg}50` : "transparent" }}><td style={td}>{s.type}</td><td style={tdR}>{fmt(s.sf)}</td><td style={tdN}>{s.note}</td><td style={tdC}>{s.code}</td></tr>)}
                <tr style={{ background: `${C.purple}08` }}><td style={{ padding: "12px 16px", fontWeight: 700, color: C.purple, fontSize: TYPO.body }}>SUPPORT SUBTOTAL</td><td style={{ padding: "12px 16px", fontWeight: 700, color: C.purple, fontSize: TYPO.lg, textAlign: "right", fontFamily: "'DM Mono', monospace" }}>{fmt(results.totalSupportSF)}</td><td colSpan={2}></td></tr>
              </tbody>
            </table>
            </div>
          </div>

          {/* PLUMBING DETAIL */}
          {results.plumbing && (
            <div style={rC}>
              <div style={rH}><span style={rHL}>Plumbing Fixture Detail</span><CodeTag dim>{ibc.label} §2902.1 Table 2902.1 / TAS Ch. 6</CodeTag></div>
              <div style={{ padding: "16px 24px", fontSize: TYPO.body, color: C.textMid, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 8, color: C.text }}>Student Restrooms</div>
                  <div style={{ lineHeight: 2.2 }}>
                    WC: <span style={{ fontFamily: "'DM Mono', monospace" }}>{results.plumbing.student.wc_male}M / {results.plumbing.student.wc_female}F</span> <CodeTag dim>1:50/sex</CodeTag><br />
                    Lav: <span style={{ fontFamily: "'DM Mono', monospace" }}>{results.plumbing.student.lav_male}M / {results.plumbing.student.lav_female}F</span> <CodeTag dim>1:50/sex</CodeTag><br />
                    Clusters: <span style={{ fontFamily: "'DM Mono', monospace" }}>{results.plumbing.student.clusters}</span><br />
                    <span style={{ fontSize: TYPO.xs, color: C.textDim }}>Min. 1 accessible/cluster · TAS §604</span>
                  </div>
                </div>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 8, color: C.text }}>Staff Restrooms</div>
                  <div style={{ lineHeight: 2.2 }}>
                    WC: <span style={{ fontFamily: "'DM Mono', monospace" }}>{results.plumbing.staff.wc_male}M / {results.plumbing.staff.wc_female}F</span> <CodeTag dim>Business occ.</CodeTag><br />
                    Lav: <span style={{ fontFamily: "'DM Mono', monospace" }}>{results.plumbing.staff.lav_male}M / {results.plumbing.staff.lav_female}F</span><br />
                    Clusters: <span style={{ fontFamily: "'DM Mono', monospace" }}>{results.plumbing.staff.clusters}</span> (separate)<br />
                    <span style={{ fontSize: TYPO.xs, color: C.textDim }}>Urinal sub. max {(ibc.urinalSubMax * 100).toFixed(0)}% WC · {ibc.label} §2902.1 fn.(i)</span>
                  </div>
                </div>
              </div>
              <div style={{ padding: "0 24px 12px", fontSize: TYPO.sm, color: C.textDim }}>
                Drinking Fountains: <span style={{ fontFamily: "'DM Mono', monospace", color: C.text }}>{results.plumbing.drinkingFountains}</span>
                {results.plumbing.drinkingFountains === 0 ? ` (exempt — occupant load ≤${ibc.dfExemptThreshold} per ${ibc.label})` : ` (1:100 occupants · hi-lo accessible · TAS §602)`}
              </div>
              {results.plumbing.genderNeutral && (
                <div style={{ margin: "0 24px 16px", padding: "10px 16px", borderRadius: 6, background: `${C.blue}10`, border: `1px solid ${C.blue}25`, fontSize: TYPO.sm, color: C.blue, lineHeight: 1.5 }}>
                  ℹ {ibc.label} permits multi-user gender-neutral facilities when privacy partitions comply with IPC §405.3.4. All-gender single-user rooms contribute to required fixture count per §2902.1.2. Group E occupancies must maintain separate facilities unless exception criteria are met.
                </div>
              )}
            </div>
          )}

          {/* SECTION 3 */}
          <div style={secL}>Section 3 — Gross Building Area <CodeTag dim>Industry Standard</CodeTag></div>
          <div style={rC}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: TYPO.bodyLg }}>
              <tbody>
                <tr><td style={td}>Instructional + Common</td><td style={tdR}>{fmt(results.totalInstructionalSF + results.librarySF + results.gymSF)}</td><td style={tdN}>Section 1</td></tr>
                <tr><td style={td}>Support & Service</td><td style={tdR}>{fmt(results.totalSupportSF)}</td><td style={tdN}>Section 2</td></tr>
                <tr style={{ background: `${C.text}05` }}><td style={{ ...td, fontWeight: 700 }}>Total Net SF</td><td style={{ ...tdR, fontWeight: 700 }}>{fmt(results.netSF)}</td><td style={tdN}>Sum of assignable spaces</td></tr>
                <tr><td style={td}>Net-to-Gross Factor</td><td style={tdR}>×{effectiveGross.toFixed(2)}</td><td style={tdN}>Walls, corridors, circulation, stairs, structure</td></tr>
                <tr style={{ background: `${C.accent}08` }}><td style={{ padding: "14px 16px", fontWeight: 700, color: C.accent, fontSize: TYPO.bodyLg }}>ESTIMATED GROSS BUILDING SF</td><td style={{ padding: "14px 16px", fontWeight: 700, color: C.accent, fontSize: TYPO.lg, textAlign: "right", fontFamily: "'DM Mono', monospace" }}>{fmt(finalGrossSF)}</td><td></td></tr>
              </tbody>
            </table>
          </div>

          {/* ASSUMPTIONS */}
          <div style={rC}>
            <div style={rH}><span style={rHL}>Assumptions, Caveats & Code References</span></div>
            <div style={{ fontSize: TYPO.sm, color: C.textDim, lineHeight: 1.7, padding: "16px 24px", borderTop: `1px solid ${C.border}` }}>
              <strong>Building code:</strong> {ibc.label} selected. Plumbing fixture ratios for Group E (Educational): WC 1:50/sex, Lav 1:50/sex, DF 1:100 — consistent across IBC 2003–2024. Staff areas at Business occupancy rates. Urinal substitution capped at {(ibc.urinalSubMax * 100).toFixed(0)}% of required WC in educational occupancies.
              {ibc.genderNeutralProvisions && ` Multi-user gender-neutral provisions available per ${ibc.label} §2902.1.2 / §2902.2.`}
              {ibc.dfExemptThreshold > 0 && ` Drinking fountain exemption: occupant loads ≤${ibc.dfExemptThreshold} per ${ibc.label}.`}
              <br /><br />
              <strong>TEA compliance:</strong> {complianceMethod === "quantitative" ? "Quantitative" : "Qualitative"} method per §61.1040({complianceMethod === "quantitative" ? "h" : "i"}). Aggregate = {sfpp} SF/pp × {fmt(studentCount)} = {fmt(results.aggregateSF)} SF.
              {complianceMethod === "qualitative" ? " Requires board-approved innovative instructional practices (§61.1040(i))." : ""}
              <br /><br />
              <strong>Cafeteria:</strong> Quantitative (§61.1040(h)(1)): cafeterias/gyms may <em>not</em> count. Qualitative (§61.1040(i)(2)): cafeterias/library <em>may</em> count at 0.5 (≤50% day) or 1.0 (&gt;50%). Gyms excluded under both methods.
              <br /><br />
              <strong>Unincorporated areas:</strong> Per §61.1040(j)(1)(A), projects outside municipal jurisdiction without adopted codes default to IBC 2003. Select "IBC 2003" if this applies.
              <br /><br />
              <strong style={{ color: C.accent }}>Disclaimer:</strong> Estimated minimums for early feasibility. Science lab safety (chemical storage (F), fume hoods (D), eye/face wash (G), safety showers (H), emergency shut-offs (J) per §61.1040(g)(2)) not sized by this tool. Local amendments may modify IBC requirements — verify with AHJ. Does not replace licensed architect or engineer services.
            </div>
          </div>
        </>)}
      </div>
    </div>
  );
}
