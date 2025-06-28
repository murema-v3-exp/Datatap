# DataTap – Open Payments Demo (Interledger Hackathon)

DataTap turns any fibre connection into a Pay-As-You-Go Wi-Fi hotspot using the Interledger Protocol (ILP).  
This prototype demonstrates how an Open Payments-enabled flow could allow people to pay for access using wallet-to-wallet payments.

## 🚧 Status

**⚠️ Functionality currently only works up to quote creation and grant request.  
The final step (submitting the outgoing payment) does not work yet** due to missing state required for finalizing the interactive grant.  
Specifically, we do not yet persist the `interact_ref` or manage the authorization callback flow needed to resume the grant and finalize the payment.

---

## ✅ Features Working

- [x] Create and authorize an **incoming payment**
- [x] Create a **quote** for the sender
- [x] Request an **interactive grant** for an outgoing payment
- [x] Receive a **redirect URL** to authorize payment via the wallet
- [x] Save state (quote and pending grant) to a simple local `db.json`

---

## ❌ Features Not Yet Working

- [ ] **Finalizing the grant** after user authorizes
- [ ] **Submitting and confirming the outgoing payment**

This requires deeper session state and grant management or a front-end flow to resume from the redirect URL (out of scope for this demo).

---

## 📁 Project Structure
