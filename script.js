const videoElement = document.getElementById("video");
const canvasElement = document.getElementById("canvas");
const canvasCtx = canvasElement.getContext("2d");
const switchCameraBtn = document.getElementById("switchCameraBtn");
const startBtn = document.getElementById("startBtn");

let pose, camera;
let useFrontCamera = false;

// ✅ เริ่มต้นขอสิทธิ์กล้อง
async function setupCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: useFrontCamera ? "user" : "environment" },
      audio: false
    });
    videoElement.srcObject = stream;
    await videoElement.play();
    return true;
  } catch (e) {
    alert("❌ ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตการเข้าถึงกล้อง");
    console.error(e);
    return false;
  }
}

// ✅ สลับกล้อง
switchCameraBtn.addEventListener("click", async () => {
  useFrontCamera = !useFrontCamera;
  if (camera) {
    camera.stop();
  }
  await setupCamera();
  startPoseDetection();
});

// ✅ คำนวณมุม
function angle(a, b, c) {
  const ab = { x: b.x - a.x, y: b.y - a.y };
  const cb = { x: b.x - c.x, y: b.y - c.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const magAB = Math.sqrt(ab.x ** 2 + ab.y ** 2);
  const magCB = Math.sqrt(cb.x ** 2 + cb.y ** 2);
  const cos = dot / (magAB * magCB);
  return Math.acos(Math.min(Math.max(cos, -1), 1)) * (180 / Math.PI);
}

// ✅ คำนวณ REBA และผล
function calculateREBA(landmarks) {
  const w = parseFloat(document.getElementById("weight").value) || 0;
  const activity = document.getElementById("activity").value;
  let score = 0;
  let detail = [];

  const neckAngle = angle(landmarks[0], landmarks[11], landmarks[12]);
  const backAngle = angle(landmarks[11], landmarks[23], landmarks[25]);
  const armAngle = angle(landmarks[11], landmarks[13], landmarks[15]);
  const legAngle = angle(landmarks[23], landmarks[25], landmarks[27]);

  if (neckAngle < 60 || neckAngle > 120) score += 2;
  if (backAngle < 160) score += 2;
  if (armAngle < 80 || armAngle > 160) score += 2;
  if (legAngle < 160) score += 1;
  if (w > 5 && w <= 10) score += 1;
  else if (w > 10) score += 2;
  if (activity === "ยกของ") score += 1;
  if (activity === "ก้ม") score += 1;

  detail.push(`คอ: ${neckAngle.toFixed(1)}°`);
  detail.push(`หลัง: ${backAngle.toFixed(1)}°`);
  detail.push(`แขน: ${armAngle.toFixed(1)}°`);
  detail.push(`ขา: ${legAngle.toFixed(1)}°`);

  return { score, detail };
}

// ✅ ระดับความเสี่ยงและคำแนะนำ
function getRiskLevel(score) {
  if (score <= 3) return ["ต่ำ", "ท่าทางดีมาก"];
  if (score <= 6) return ["ปานกลาง", "ควรปรับหลังตรงและลดการก้ม"];
  if (score <= 9) return ["สูง", "ควรหลีกเลี่ยงการยกของหนักหรือก้มมาก"];
  return ["สูงมาก", "เสี่ยงมาก! ปรับท่าทางหรือใช้เครื่องช่วย"];
}

// ✅ เริ่มประเมิน
async function startPoseDetection() {
  pose = new Pose.Pose({
    locateFile: (file) => https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}
  });

  pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });

  pose.onResults(onResults);

  const cam = new CameraUtils.Camera(videoElement, {
    onFrame: async () => {
      await pose.send({ image: videoElement });
    },
    width: 640,
    height: 480
  });

  cam.start();
}

// ✅ วาดผลลัพธ์
function onResults(results) {
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

  if (!results.poseLandmarks) return;

  for (const kp of results.poseLandmarks) {
    canvasCtx.beginPath();
    canvasCtx.arc(kp.x * canvasElement.width, kp.y * canvasElement.height, 4, 0, 2 * Math.PI);
    canvasCtx.fillStyle = "red";
    canvasCtx.fill();
  }

  const { score, detail } = calculateREBA(results.poseLandmarks);
  const [level, advice] = getRiskLevel(score);

  document.getElementById("rebaScore").textContent = score;
  document.getElementById("riskLevel").textContent = level;
  document.getElementById("adviceText").textContent = advice;

  const ul = document.getElementById("angleDetails");
  ul.innerHTML = "";
  detail.forEach(d => {
    const li = document.createElement("li");
    li.textContent = d;
    ul.appendChild(li);
  });
}

// ✅ เริ่มเมื่อกดปุ่ม
startBtn.addEventListener("click", async () => {
  const ok = await setupCamera();
  if (ok) startPoseDetection();
});
