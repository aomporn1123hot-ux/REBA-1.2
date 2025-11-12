const videoElement = document.getElementById("video");
const canvasElement = document.getElementById("canvas");
const ctx = canvasElement.getContext("2d");

const switchCameraBtn = document.getElementById("switchCameraBtn");
const startBtn = document.getElementById("startBtn");

let useFrontCamera = false;
let currentStream = null;
let pose = null;

// ✅ ฟังก์ชันเปิดกล้อง
async function setupCamera() {
  if (currentStream) {
    currentStream.getTracks().forEach(t => t.stop());
  }
  try {
    currentStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: useFrontCamera ? "user" : "environment" },
      audio: false
    });
    videoElement.srcObject = currentStream;
    await videoElement.play();
  } catch (err) {
    alert("❌ กรุณาอนุญาตให้เข้าถึงกล้องใน Safari (Settings → Safari → Camera → Allow)");
    console.error(err);
  }
}

// ✅ ฟังก์ชันคำนวณมุม
function angle(a, b, c) {
  const ab = { x: b.x - a.x, y: b.y - a.y };
  const cb = { x: b.x - c.x, y: b.y - c.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const magAB = Math.sqrt(ab.x ** 2 + ab.y ** 2);
  const magCB = Math.sqrt(cb.x ** 2 + cb.y ** 2);
  const cos = dot / (magAB * magCB);
  return Math.acos(Math.min(Math.max(cos, -1), 1)) * (180 / Math.PI);
}

// ✅ คำนวณ REBA
function calculateREBA(landmarks) {
  if (!landmarks) return { score: 0, detail: [] };
  const neck = angle(landmarks[0], landmarks[11], landmarks[12]);
  const back = angle(landmarks[11], landmarks[23], landmarks[25]);
  const arm = angle(landmarks[11], landmarks[13], landmarks[15]);
  const leg = angle(landmarks[23], landmarks[25], landmarks[27]);
  let score = 0;
  if (neck < 60 || neck > 120) score += 2;
  if (back < 160) score += 2;
  if (arm < 80 || arm > 160) score += 2;
  if (leg < 160) score += 1;
  return { 
    score, 
    detail: [
      `คอ: ${neck.toFixed(1)}°`, 
      `หลัง: ${back.toFixed(1)}°`,
      `แขน: ${arm.toFixed(1)}°`,
      ขา: ${leg.toFixed(1)}°
    ]
  };
}

// ✅ ระดับความเสี่ยง
function getRiskLevel(score) {
  if (score <= 3) return ["ต่ำ", "ท่าทางดีมาก"];
  if (score <= 6) return ["ปานกลาง", "ควรปรับหลังตรงและลดการก้ม"];
  if (score <= 9) return ["สูง", "ควรหลีกเลี่ยงการยกของหนักหรือก้มมาก"];
  return ["สูงมาก", "เสี่ยงมาก! ควรปรับท่าทางหรือใช้เครื่องช่วย"];
}

// ✅ สลับกล้อง 🔃
switchCameraBtn.addEventListener("click", async () => {
  useFrontCamera = !useFrontCamera;
  await setupCamera();
});

// ✅ เริ่มประเมิน
startBtn.addEventListener("click", async () => {
  await setupCamera();

  // โหลดโมเดล Pose
  if (!pose) {
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
  }

  async function detectionLoop() {
    await pose.send({ image: videoElement });
    requestAnimationFrame(detectionLoop);
  }
  detectionLoop();
});

// ✅ แสดงผล
function onResults(results) {
  ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  ctx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

  if (!results.poseLandmarks) return;

  // วาดจุด keypoints
  for (const kp of results.poseLandmarks) {
    ctx.beginPath();
    ctx.arc(kp.x * canvasElement.width, kp.y * canvasElement.height, 4, 0, 2 * Math.PI);
    ctx.fillStyle = "red";
    ctx.fill();
  }

  const { score, detail } = calculateREBA(results.poseLandmarks);
  const [level, advice] = getRiskLevel(score);

  document.getElementById("rebaScore").textContent = score;
  document.getElementById("riskLevel").textContent = level;
  document.getElementById("adviceText").textContent = advice;

  const list = document.getElementById("angleDetails");
  list.innerHTML = "";
  detail.forEach(d => {
    const li = document.createElement("li");
    li.textContent = d;
    list.appendChild(li);
  });
}
