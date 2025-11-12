const videoElement = document.getElementById('video');
const canvasElement = document.getElementById('output');
const canvasCtx = canvasElement.getContext('2d');

const rebaScoreEl = document.getElementById('rebaScore');
const riskLevelEl = document.getElementById('riskLevel');
const angleDetailsEl = document.getElementById('angleDetails');
const startBtn = document.getElementById('startBtn');
const captureBtn = document.getElementById('captureBtn');
const switchCameraBtn = document.getElementById('switchCameraBtn');
const weightInput = document.getElementById('weight');
const activityInput = document.getElementById('activity');

let pose;
let camera;
let useFrontCamera = false;
let lastResults = null; // เก็บผลล่าสุดของโครงร่างจากกล้อง

// === ฟังก์ชันคำนวณมุม ===
function angle(a, b, c) {
  const ab = { x: b.x - a.x, y: b.y - a.y };
  const cb = { x: b.x - c.x, y: b.y - c.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const magAB = Math.sqrt(ab.x ** 2 + ab.y ** 2);
  const magCB = Math.sqrt(cb.x ** 2 + cb.y ** 2);
  const cosTheta = dot / (magAB * magCB);
  return Math.acos(Math.max(-1, Math.min(1, cosTheta))) * (180 / Math.PI);
}

// === คำนวณคะแนน ===
function calculateREBA(keypoints) {
  let score = 0;
  const details = [];
  const weight = parseFloat(weightInput.value) || 0;
  const activity = activityInput.value;

  // คอ
  if (keypoints[0] && keypoints[11] && keypoints[12]) {
    const neckAngle = angle(keypoints[0], keypoints[11], keypoints[12]);
    let s = (neckAngle < 40 || neckAngle > 140) ? 2 : (neckAngle < 60 || neckAngle > 120 ? 1 : 0);
    score += s;
    details.push(`คอ: ${neckAngle.toFixed(1)}° (คะแนน ${s}) → ${neckAdvice(neckAngle)}`);
  }

  // หลัง
  if (keypoints[11] && keypoints[23] && keypoints[25]) {
    const backAngle = angle(keypoints[11], keypoints[23], keypoints[25]);
    let s = (backAngle < 140) ? 3 : (backAngle < 160 ? 2 : 1);
    score += s;
    details.push(`หลัง: ${backAngle.toFixed(1)}° (คะแนน ${s}) → ${backAdvice(backAngle)}`);
  }

  // แขน
  if (keypoints[13] && keypoints[11] && keypoints[15]) {
    const elbowAngle = angle(keypoints[11], keypoints[13], keypoints[15]);
    let s = (elbowAngle < 60 || elbowAngle > 120) ? 2 : 0;
    score += s;
    details.push(`แขน: ${elbowAngle.toFixed(1)}° (คะแนน ${s}) → ${armAdvice(elbowAngle)}`);
  }

  // ขา
  if (keypoints[23] && keypoints[25] && keypoints[27]) {
    const legAngle = angle(keypoints[23], keypoints[25], keypoints[27]);
    let s = (legAngle < 160) ? 2 : 0;
    score += s;
    details.push(`ขา: ${legAngle.toFixed(1)}° (คะแนน ${s}) → ${legAdvice(legAngle)}`);
  }

  // น้ำหนัก
  let wScore = 0;
  if (weight > 0) {
    if (weight <= 5) wScore = 1;
    else if (weight <= 10) wScore = 2;
    else wScore = 3;
    score += wScore;
    details.push(`น้ำหนัก: ${weight} กก. (คะแนน ${wScore})`);
  }

  // กิจกรรม
  let aScore = (activity === "ก้ม" || activity === "ยกของ") ? 1 : 0;
  score += aScore;
  details.push(`กิจกรรม: ${activity} (คะแนน ${aScore})`);

  return { score, details };
}

// === คำแนะนำแต่ละส่วน ===
function neckAdvice(a) { return (a < 40 || a > 140) ? "เงยหรืองอคอมากเกินไป ควรปรับให้อยู่ระดับปกติ" : "ท่าคอเหมาะสม"; }
function backAdvice(a) { return (a < 140) ? "หลังงอมาก ควรยืดหลังให้ตรงขึ้น" : "หลังอยู่ในระดับปลอดภัย"; }
function armAdvice(a) { return (a < 60 || a > 120) ? "แขนงอหรือเหยียดมากเกินไป ควรอยู่กึ่งกลาง" : "ท่าแขนปกติ"; }
function legAdvice(a) { return (a < 160) ? "ขาอาจงอมาก ควรยืดให้มั่นคง" : "ขาอยู่ในท่าที่ดี"; }

function getRiskLevel(score) {
  if (score <= 3) return "ต่ำ";
  if (score <= 5) return "ปานกลาง";
  if (score <= 7) return "สูง";
  return "สูงมาก";
}

// === เริ่มกล้อง ===
function startCamera() {
  if (camera) camera.stop();

  camera = new Camera(videoElement, {
    onFrame: async () => await pose.send({ image: videoElement }),
    width: 640,
    height: 480,
    facingMode: useFrontCamera ? "user" : { exact: "environment" },
  });
  camera.start();
}

function startAssessment() {
  pose = new Pose({ locateFile: (file) => https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file} });
  pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    enableSegmentation: false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  pose.onResults((r) => (lastResults = r)); // เก็บผลล่าสุดไว้
  startCamera();
  captureBtn.disabled = false;
}

function captureSnapshot() {
  if (!lastResults || !lastResults.poseLandmarks) {
    alert("ยังไม่ตรวจจับท่าทางได้ กรุณารอให้กล้องจับได้ก่อน");
    return;
  }

  const results = lastResults;

  // วาดภาพนิ่ง
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
  for (const kp of results.poseLandmarks) {
    canvasCtx.beginPath();
    canvasCtx.arc(kp.x * canvasElement.width, kp.y * canvasElement.height, 4, 0, 2 * Math.PI);
    canvasCtx.fillStyle = 'red';
    canvasCtx.fill();
  }
  canvasCtx.restore();

  const { score, details } = calculateREBA(results.poseLandmarks);
  rebaScoreEl.textContent = score;
  riskLevelEl.textContent = getRiskLevel(score);
  angleDetailsEl.innerHTML = details.map(d => `<li>${d}</li>`).join("");
}

// === ปุ่ม ===
switchCameraBtn.addEventListener('click', () => {
  useFrontCamera = !useFrontCamera;
  startCamera();
});

startBtn.addEventListener('click', startAssessment);
captureBtn.addEventListener('click', captureSnapshot);
