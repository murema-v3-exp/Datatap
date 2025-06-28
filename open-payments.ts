import dotenv from "dotenv";
import {
  createAuthenticatedClient,
  OpenPaymentsClientError,
  isFinalizedGrant,
  isPendingGrant,
  AuthenticatedClient,
} from "@interledger/open-payments";

dotenv.config({ path: ".env" });

/**
 * Full Open Payments flow (incoming → quote → interactive grant)
 * Returns info required to authorize and complete outgoing payment.
 */
export async function processFullPayment({
  senderWalletUrl,
  receiverWalletUrl,
  amount = "1000",
}: {
  senderWalletUrl: string;
  receiverWalletUrl: string;
  amount?: string;
}) {
  // 1. Initialize client for the sender wallet
  const client = await createAuthenticatedClient({
    walletAddressUrl: process.env.OPEN_PAYMENTS_CLIENT_ADDRESS!,
    privateKey: process.env.OPEN_PAYMENTS_SECRET_KEY_PATH!,
    keyId: process.env.OPEN_PAYMENTS_KEY_ID!,
  });

  // 2. Fetch sender & receiver wallet details
  const sendingWalletAddress = await client.walletAddress.get({ url: senderWalletUrl });
  const receivingWalletAddress = await client.walletAddress.get({ url: receiverWalletUrl });

// 3. Request grant and create incoming payment (receiver side)
const incomingPaymentGrant = await client.grant.request(
  { url: receivingWalletAddress.authServer },
  {
    access_token: {
      access: [
        {
          type: "incoming-payment",
          actions: ["read", "complete", "create"],
        },
      ],
    },
  }
);

if (!isFinalizedGrant(incomingPaymentGrant)) {
  throw new Error("Incoming payment grant not finalized.");
}

const incomingPayment = await client.incomingPayment.create(
  {
    url: receivingWalletAddress.resourceServer,
    accessToken: incomingPaymentGrant.access_token.value,
  },
  {
    walletAddress: receivingWalletAddress.id,
    incomingAmount: {
      assetCode: receivingWalletAddress.assetCode,
      assetScale: receivingWalletAddress.assetScale,
      value: amount,
    },
  }
);

// 4. Request grant and create quote (sender side)
const quoteGrant = await client.grant.request(
  { url: sendingWalletAddress.authServer },
  {
    access_token: {
      access: [
        {
          type: "quote",
          actions: ["create", "read"],
        },
      ],
    },
  }
);

if (!isFinalizedGrant(quoteGrant)) {
  throw new Error("Quote grant not finalized.");
}

const quote = await client.quote.create(
  {
    url: sendingWalletAddress.resourceServer,
    accessToken: quoteGrant.access_token.value,
  },
  {
    walletAddress: sendingWalletAddress.id,
    receiver: incomingPayment.id,
    method: "ilp",
  }
);

// 5. Request interactive grant for outgoing payment
const outgoingPaymentGrant = await client.grant.request(
  { url: sendingWalletAddress.authServer },
  {
    access_token: {
      access: [
        {
          type: "outgoing-payment",
          actions: ["read", "create"],
          limits: {
            debitAmount: quote.debitAmount,
          },
          identifier: sendingWalletAddress.id,
        },
      ],
    },
    interact: {
      start: ["redirect"],
    },
  }
);

if (!isPendingGrant(outgoingPaymentGrant)) {
  throw new Error("Expected a pending grant for interactive flow.");
}

return {
  redirectUrl: outgoingPaymentGrant.interact.redirect,
  continuation: {
    uri: outgoingPaymentGrant.continue.uri,
    accessToken: outgoingPaymentGrant.continue.access_token.value,
    quoteId: quote.id,
    senderWalletAddress: sendingWalletAddress.id,
  },
  quote,
  incomingPayment,
};
}

/**
 * Finalizes an interactive grant and submits the outgoing payment.
 */
export async function finalizeOutgoingPayment({
  uri,
  accessToken,
  senderWalletAddress,
  quoteId,
}: {
  uri: string;
  accessToken: string;
  senderWalletAddress: string;
  quoteId: string;
}) {
  // 1. Initialize client for sender wallet again (reuse credentials)
  const client = await createAuthenticatedClient({
    walletAddressUrl: process.env.OPEN_PAYMENTS_CLIENT_ADDRESS ?? "",
    privateKey: process.env.OPEN_PAYMENTS_SECRET_KEY_PATH ?? "",
    keyId: process.env.OPEN_PAYMENTS_KEY_ID ?? "",
  });

// 2. Resume the interactive grant after user authorizes
const grant = await client.grant.continue({
  url: uri,
  accessToken,
},);

if (!isFinalizedGrant(grant)) {
  throw new Error("Grant was not finalized.");
}

const outgoingPayment = await client.outgoingPayment.create(
  {
    url: senderWalletAddress,
    accessToken: grant.access_token.value,
  },
  {
    walletAddress: senderWalletAddress,
    quoteId,
  }
);



return outgoingPayment;
}
