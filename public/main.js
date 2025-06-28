let currentScreen = 'main-screen';
let sessionData = {
    startTime: null,
    spendingLimit: 5.00,
    amountSpent: 0,
    rate: 0.10,
    hostName: "Sarah's Café",
    sessionActive: false,
    totalEarnings: 0,
    sessionCount: 0
};

let sessionTimer = null;

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
    currentScreen = screenId;
}

function generateQR() {
    const hostName = document.getElementById('host-name').value;
    const price = document.getElementById('price-select').value;
    sessionData.hostName = hostName;
    sessionData.rate = parseFloat(price);
    document.getElementById('current-rate').textContent = `R${price}/min`;
    showScreen('qr-display');
}

function simulateQRScan() {
    document.getElementById('display-price').textContent = `R${sessionData.rate}/min`;
    showScreen('hotspot-info');
}

function updateTimeEstimate() {
    const limit = parseFloat(document.getElementById('spending-limit').value);
    const rate = sessionData.rate;
    const minutes = Math.floor(limit / rate);
    document.getElementById('rate-display').textContent = rate.toFixed(2);
    document.getElementById('time-estimate').textContent = minutes;
}

document.getElementById('spending-limit').addEventListener('input', updateTimeEstimate);

function startSession() {
    const limit = parseFloat(document.getElementById('spending-limit').value);
    sessionData.spendingLimit = limit;
    sessionData.amountSpent = 0;
    sessionData.startTime = new Date();
    sessionData.sessionActive = true;
    document.getElementById('session-limit').textContent = limit.toFixed(2);
    document.getElementById('remaining-amount').textContent = `R${limit.toFixed(2)}`;
    showScreen('active-session');
    startSessionTimer();
    initiatePayment(); // trigger backend payment setup
}

function startSessionTimer() {
    sessionTimer = setInterval(() => {
        if (!sessionData.sessionActive) return;
        const elapsed = (new Date() - sessionData.startTime) / 1000;
        const minutes = Math.floor(elapsed / 60);
        const seconds = Math.floor(elapsed % 60);
        const amountSpent = (elapsed / 60) * sessionData.rate;
        sessionData.amountSpent = amountSpent;

        document.getElementById('session-time').textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        document.getElementById('amount-spent').textContent = amountSpent.toFixed(2);
        const remaining = sessionData.spendingLimit - amountSpent;
        document.getElementById('remaining-amount').textContent = `R${Math.max(0, remaining).toFixed(2)}`;
        const progress = (amountSpent / sessionData.spendingLimit) * 100;
        document.getElementById('spending-progress').style.width = `${Math.min(100, progress)}%`;

        if (progress >= 85 && progress < 100) {
            document.getElementById('limit-warning').classList.add('show');
            document.getElementById('session-controls').style.display = 'none';
            document.getElementById('continue-controls').style.display = 'block';
        }

        if (amountSpent >= sessionData.spendingLimit) {
            endSession();
        }
    }, 1000);
}

function continueSession() {
    sessionData.spendingLimit += 5.00;
    document.getElementById('session-limit').textContent = sessionData.spendingLimit.toFixed(2);
    document.getElementById('limit-warning').classList.remove('show');
    document.getElementById('session-controls').style.display = 'block';
    document.getElementById('continue-controls').style.display = 'none';
}

function endSession() {
    sessionData.sessionActive = false;
    clearInterval(sessionTimer);
    const elapsed = (new Date() - sessionData.startTime) / 1000;
    const minutes = Math.floor(elapsed / 60);
    const seconds = Math.floor(elapsed % 60);

    document.getElementById('final-time').textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    document.getElementById('final-amount').textContent = sessionData.amountSpent.toFixed(2);
    document.getElementById('final-host').textContent = sessionData.hostName;

    sessionData.totalEarnings += sessionData.amountSpent;
    sessionData.sessionCount += 1;

    document.getElementById('total-earnings').textContent = `R${sessionData.totalEarnings.toFixed(2)}`;
    document.getElementById('session-count').textContent = sessionData.sessionCount;
    document.getElementById('avg-duration').textContent = `${Math.floor(elapsed / 60)} min`;

    finalizePayment();
    showScreen('session-ended');
}

// === Open Payments Integration ===

async function initiatePayment() {
  const senderWalletUrl = "https://ilp.interledger-test.dev/rer"; 
  const receiverWalletUrl = "https://ilp.interledger-test.dev/8b3b2577";
  const amount = "10";

  const res = await fetch("/api/pay", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ senderWalletUrl, receiverWalletUrl, amount }),
  });

  const data = await res.json();

  if (res.ok) {
    console.log("Step 1: Payment initialized", data);
    sessionStorage.setItem("paymentContinuation", JSON.stringify(data.continuation));
    window.open(data.redirectUrl, "_blank");
    alert("Please approve the payment in the new tab, then continue.");
  } else {
    console.error("Failed to initiate payment", data);
    alert("Failed to initiate payment");
  }
}

async function finalizePayment() {
  const cont = JSON.parse(sessionStorage.getItem("paymentContinuation"));
  if (!cont) {
    console.error("Missing continuation data");
    return;
  }

  const res = await fetch("/api/finalize-payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      uri: cont.uri,
      accessToken: cont.accessToken,
      senderWalletAddress: cont.senderWalletAddress,
      quoteId: cont.quoteId,
    }),
  });

  const data = await res.json();

  if (res.ok) {
    console.log("Step 2: Outgoing payment completed:", data);
    alert("✅ Payment completed successfully!");
  } else {
    console.error("Failed to finalize payment", data);
    alert("❌ Failed to finalize payment");
  }
}

updateTimeEstimate();
