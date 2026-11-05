const c = (id, en, de, basis = 'machine_display', increment = 2.5, rest = 90) => ({ id, en, de, basis, increment, rest });
export const catalog = [
    c('barbell_bench_press', 'Barbell Bench Press', 'Bankdrücken mit Langhantel', 'total', 2.5, 180),
    c('incline_dumbbell_press', 'Incline Dumbbell Press', 'Schrägbankdrücken mit Kurzhanteln', 'dumbbell_each', 2, 150),
    c('chest_press_machine', 'Machine Chest Press', 'Brustpresse an der Maschine', 'machine_display', 5, 120),
    c('lateral_raise_machine', 'Machine Lateral Raise', 'Seitheben an der Maschine', 'machine_display', 5, 90),
    c('butterfly_machine', 'Pec Deck Fly', 'Butterfly an der Maschine', 'machine_display', 5, 90),
    c('triceps_pushdown', 'Cable Triceps Pushdown', 'Trizepsdrücken am Kabelzug', 'machine_display', 5, 90),
    c('single_arm_triceps_pushdown', 'Single-Arm Triceps Pushdown', 'Einarmiges Trizepsdrücken am Kabelzug', 'machine_display', 2.5, 90),
    c('iso_lat_pulldown', 'Iso-Lateral Lat Pulldown', 'Iso-Lateraler Latzug', 'per_side', 2.5, 150),
    c('t_bar_row', 'T-Bar Row', 'T-Bar-Rudern', 'total', 2.5, 150),
    c('cable_pullover', 'Cable Pullover', 'Kabel-Pullover', 'machine_display', 5, 120),
    c('reverse_fly_cable', 'Cable Reverse Fly', 'Reverse Flys am Kabelzug', 'machine_display', 2.5, 90),
    c('hammer_curl_dumbbell', 'Dumbbell Hammer Curl', 'Hammer-Curls mit Kurzhanteln', 'dumbbell_each', 2, 90),
    c('incline_dumbbell_curl', 'Incline Dumbbell Curl', 'Schrägbank-Curls mit Kurzhanteln', 'dumbbell_each', 2, 90),
    c('cable_crunch', 'Cable Crunch', 'Bauchpressen am Kabelzug', 'machine_display', 5, 90),
    c('leg_curl_machine', 'Leg Curl Machine', 'Beinbeuger an der Maschine', 'machine_display', 5, 90),
    c('romanian_deadlift', 'Romanian Deadlift', 'Rumänisches Kreuzheben', 'total', 2.5, 180),
    c('hack_squat', 'Hack Squat', 'Hackenschmidt-Kniebeuge', 'per_side', 2.5, 180),
    c('adductor_machine', 'Adductor Machine', 'Adduktoren-Maschine', 'machine_display', 5, 90),
    c('abductor_machine', 'Abductor Machine', 'Abduktoren-Maschine', 'machine_display', 5, 90),
    c('standing_calf_raise', 'Standing Calf Raise', 'Wadenheben stehend', 'machine_display', 5, 90),
    c('seated_calf_raise', 'Seated Calf Raise', 'Wadenheben sitzend', 'machine_display', 5, 90),
    c('smith_shoulder_press', 'Smith Machine Shoulder Press', 'Schulterdrücken an der Smith-Maschine', 'machine_display', 2.5, 180),
    c('upright_cable_row', 'Cable Upright Row', 'Aufrechtes Rudern am Kabelzug', 'machine_display', 5, 120),
    c('single_arm_cable_lateral_raise', 'Single-Arm Cable Lateral Raise', 'Einarmiges Seitheben am Kabelzug', 'machine_display', 2.5, 90),
    c('dumbbell_lateral_raise', 'Dumbbell Lateral Raise', 'Seitheben mit Kurzhanteln', 'dumbbell_each', 2, 90),
    c('face_pull', 'Cable Face Pull', 'Face Pulls am Kabelzug', 'machine_display', 5, 90),
    c('dual_incline_press', 'Dual Incline Chest Press', 'Duale Schrägbank-Brustpresse', 'per_side', 2.5, 120),
    c('dual_flat_press', 'Dual Flat Chest Press', 'Duale flache Brustpresse', 'per_side', 2.5, 120),
    c('supine_cable_fly', 'Supine Cable Fly', 'Liegende Cable Flys', 'machine_display', 2.5, 90),
    c('cable_chest_press', 'Cable Chest Press', 'Brustdrücken am Kabelzug', 'machine_display', 5, 120),
    c('cable_lateral_raise', 'Cable Lateral Raise', 'Seitheben am Kabelzug', 'machine_display', 2.5, 90),
    c('overhead_triceps_extension_cable', 'Overhead Cable Triceps Extension', 'Trizepsstrecken über Kopf am Kabelzug', 'machine_display', 5, 90),
    c('close_cable_row', 'Close-Grip Cable Row', 'Enges Kabelrudern', 'machine_display', 5, 120),
    c('wide_lat_pulldown', 'Wide-Grip Lat Pulldown', 'Latzug mit weitem Griff', 'machine_display', 5, 120),
    c('wide_row_machine', 'Wide Row Machine', 'Breites Rudern an der Maschine', 'machine_display', 5, 120),
    c('single_arm_high_row', 'Seated Single-Arm High Row', 'Sitzendes einarmiges High Row', 'per_side', 5, 120),
    c('cable_ez_curl', 'Cable EZ-Bar Curl', 'SZ-Curls am Kabelzug', 'machine_display', 5, 90),
    c('cable_hammer_curl_rope', 'Rope Hammer Curl', 'Hammer-Curls am Seilzug', 'machine_display', 5, 90),
    c('triceps_pushdown_rope', 'Rope Triceps Pushdown', 'Trizeps-Pushdown mit Seil', 'machine_display', 5, 90),
    c('hyperextension', 'Back Extension', 'Hyperextensions', 'bodyweight', 2.5, 90)
];
export const byId = new Map(catalog.map(x => [x.id, x]));
export const plans = {
    1: { name: 'PUSH · STRENGTH', subtitle: 'Brust schwer · Schultern · Trizeps', ids: ['barbell_bench_press', 'incline_dumbbell_press', 'chest_press_machine', 'lateral_raise_machine', 'butterfly_machine', 'triceps_pushdown', 'single_arm_triceps_pushdown'] },
    2: { name: 'PULL', subtitle: 'Rücken · Bizeps · Core', ids: ['iso_lat_pulldown', 't_bar_row', 'cable_pullover', 'reverse_fly_cable', 'hammer_curl_dumbbell', 'incline_dumbbell_curl', 'cable_crunch'] },
    3: { name: 'LEGS', subtitle: 'Beine · Waden', ids: ['leg_curl_machine', 'romanian_deadlift', 'hack_squat', 'adductor_machine', 'abductor_machine', 'standing_calf_raise'] },
    4: { name: 'SHOULDERS', subtitle: 'Schulter-Spezialisierung · Core', ids: ['smith_shoulder_press', 'upright_cable_row', 'single_arm_cable_lateral_raise', 'dumbbell_lateral_raise', 'reverse_fly_cable', 'face_pull', 'cable_crunch'], optional: ['cable_crunch'] },
    5: { name: 'PUSH · HYPERTROPHY', subtitle: 'Brustvolumen · Trizeps', ids: ['dual_incline_press', 'dual_flat_press', 'supine_cable_fly', 'cable_chest_press', 'cable_lateral_raise', 'overhead_triceps_extension_cable', 'single_arm_triceps_pushdown'] },
    6: { name: 'PULL + ARMS', subtitle: 'Rücken · Arme · Core', ids: ['close_cable_row', 'wide_lat_pulldown', 'wide_row_machine', 'single_arm_high_row', 'cable_ez_curl', 'cable_hammer_curl_rope', 'triceps_pushdown_rope', 'cable_crunch', 'hyperextension'] }
};
export const dayNames = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
// Search metadata: existing stable exercise IDs are retained.
const groupLabels={"leg_curl_machine":"Beine","romanian_deadlift":"Beine","hack_squat":"Beine","adductor_machine":"Beine","abductor_machine":"Beine","standing_calf_raise":"Beine","seated_calf_raise":"Beine","barbell_bench_press":"Brust","incline_dumbbell_press":"Brust","iso_lat_pulldown":"Rücken","t_bar_row":"Rücken","smith_shoulder_press":"Schulter","cable_crunch":"Bauch","chest_press_machine":"Brust","lateral_raise_machine":"Schulter","butterfly_machine":"Brust","triceps_pushdown":"Arme","single_arm_triceps_pushdown":"Arme","cable_pullover":"Rücken","reverse_fly_cable":"Schulter","hammer_curl_dumbbell":"Arme","incline_dumbbell_curl":"Arme","upright_cable_row":"Schulter","single_arm_cable_lateral_raise":"Schulter","dumbbell_lateral_raise":"Schulter","face_pull":"Schulter","dual_incline_press":"Brust","dual_flat_press":"Brust","supine_cable_fly":"Brust","cable_chest_press":"Brust","cable_lateral_raise":"Schulter","overhead_triceps_extension_cable":"Arme","close_cable_row":"Rücken","wide_lat_pulldown":"Rücken","wide_row_machine":"Rücken","single_arm_high_row":"Rücken","cable_hammer_curl_rope":"Arme","triceps_pushdown_rope":"Arme","cable_ez_curl":"Arme","hyperextension":"Bauch"};
for(const e of catalog){e.groups=groupLabels[e.id]?[groupLabels[e.id]]:[];const text=(e.de+" "+e.en).toLowerCase();e.equipment=[];if(/kurzhantel|dumbbell/.test(text))e.equipment.push("Kurzhantel");if(/langhantel|barbell/.test(text))e.equipment.push("Langhantel");if(/kabel|cable/.test(text))e.equipment.push("Kabelturm");if(/maschine|machine/.test(text))e.equipment.push("Trainingsmaschine");if(/smith/.test(text))e.equipment.push("Multipresse");}
