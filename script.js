const videoElement = document.getElementById('video');
const canvasElement = document.getElementById('output');
const canvasCtx = canvasElement.getContext('2d');

const rebaScoreEl = document.getElementById('rebaScore');
const riskLevelEl = document.getElementById('riskLevel');
const angleDetailsEl = document.getElementById('angleDetails');
const startBtn = document.getElementById('startBtn');
const switchCameraBtn = document.getElementById('switchCameraBtn');
const weightInput = document.getElementById('weight');
const activityInput = document.getElementById('activity');

let pose;
let camera;
let useFrontCamera = false;

// === ฟังก์ชันคำนวณมุม ===
function angle(a, b, c) {
  const ab = {x: b.x - a.x, y: b.y - a.y};
  const cb = {x: b.x - c.x, y: b.y - c.y};
  const dot = ab.x * cb.x + ab.y * cb.y;
  const magAB = Math.sqrt(ab.x ** 2 + ab.y ** 2);
  const magCB = Math.sqrt(cb.x ** 2 + cb.y ** 2);
  const cosTheta = dot / (magAB * magCB);
  return Math.acos(Math.max(-1, Math.min(1, cosTheta))) * (180 / Math.PI);
}

// === คำนวณคะแนนและรายละเอียด ===
function calculateREBA(keypoints) {
  let score = 0;
  const details = [];
  const weight = parseFloat(weightInput.value) || 0;
  const activity = activityInput.value;

  // คอ
  if (keypoints[0] && keypoints[11] && keypoints[12]) {
    const neckAngle = angle(keypoints[0], keypoints[11], keypoints[12]);
    let partScore = 0;
    if (neckAngle < 40 || neckAngle > 140) partScore = 2;
    else if (neckAngle < 60 || neckAngle > 120) partScore = 1;
    score += partScore;
    details.push(`คอ: ${neckAngle.toFixed(1)}° (คะแนน ${partScore}) → ${neckAdvice(neckAngle)}`);
  }

  // หลัง
  if (keypoints[11] && keypoints[23] && keypoints[25]) {
    const backAngle = angle(keypoints[11], keypoints[23], keypoints[25]);
    let partScore = 1;
    if (backAngle < 140) partScore = 3;
    else if (backAngle < 160) partScore = 2;
    score += partScore;
    details.push(`หลัง: ${backAngle.toFixed(1)}° (คะแนน ${partScore}) → ${backAdvice(backAngle)}`);
  }

  // แขน
  if (keypoints[13] && keypoints[11] && keypoints[15]) {
    const elbowAngle = angle(keypoints[11], keypoints[13], keypoints[15]);
    let partScore = (elbowAngle < 60 || elbowAngle > 120) ? 2 : 0;
    score += partScore;
    details.push(`แขน: ${elbowAngle.toFixed(1)}° (คะแนน ${partScore}) → ${armAdvice(elbowAngle)}`);
  }

  // ขา
  if (keypoints[23] && keypoints[25] && keypoints[27]) {
    const legAngle = angle(keypoints[23], keypoints[25], keypoints[27]);
    let partScore = (legAngle < 160) ? 2 : 0;
    score += partScore;
    details.push(`ขา: ${legAngle.toFixed(1)}° (คะแนน ${partScore}) → ${legAdvice(legAngle)}`);
  }

  // น้ำหนักวัตถุ
  let weightScore = 0;
  if (weight > 0) {
    if (weight <= 5) weightScore = 1;
    else if (weight <= 10) weightScore = 2;
    else weightScore = 3;
    score += weightScore;
    details.push(`น้ำหนัก: ${weight} กก. (คะแนน ${weightScore})`);
  }

  // กิจกรรม
  let actScore = 0;
  if (activity === "ก้ม" || activity === "ยกของ") actScore = 1;
  score += actScore;
  details.push(`กิจกรรม: ${activity} (คะแนน ${actScore})`);

  return { score, details };
}

function neckAdvice(a) {
  if (a < 40 || a > 140) return "เงยหรืองอคอมากเกินไป ควรปรับให้อยู่ระดับปกติ";
  return "ท่าคอเหมาะสม";
}

function backAdvice(a) {
  if (a < 140) return "หลังงอมาก ควรยืดหลังให้ตรงขึ้น";
  return "หลังอยู่ในระดับปลอดภัย";
}

function armAdvice(a) {
  if (a < 60 || a > 120) return "แขนงอหรือเหยียดมากเกินไป ควรอยู่กึ่งกลาง";
  return "ท่าแขนปกติ";
}

function legAdvice(a) {
  if (a < 160) return "ขาอาจงอมาก ควรยืดให้มั่นคง";
  return "ขาอยู่ในท่าที่ดี";
}

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
  pose.onResults(onResults);
  startCamera();
}

function onResults(results) {
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

  if (results.poseLandmarks) {
    for (const kp of results.poseLandmarks) {
      canvasCtx.beginPath();
      canvasCtx.arc(kp.x * canvasElement.width, kp.y * canvasElement.height, 4, 0, 2 * Math.PI);
      canvasCtx.fillStyle = 'red';
      canvasCtx.fill();
    }

    const { score, details } = calculateREBA(results.poseLandmarks);
    rebaScoreEl.textContent = score;
    riskLevelEl.textContent = getRiskLevel(score);

    angleDetailsEl.innerHTML = details.map(d => `<li>${d}</li>`).join("");
  }

  canvasCtx.restore();
}

switchCameraBtn.addEventListener('click', () => {
  useFrontCamera = !useFrontCamera;
  startCamera();
});

startBtn.addEventListener('click', startAssessment);
