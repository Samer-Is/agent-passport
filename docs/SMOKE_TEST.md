# Agent Passport Smoke Test

> Validate your deployed Agent Passport API using curl commands. No local runtime required.

## Prerequisites

- `curl` installed
- `jq` installed (optional, for JSON formatting)
- `openssl` or a Node.js script for Ed25519 signing
- Deployed API at `https://agent-passport.onrender.com` (or your URL)
- An app ID and key from the Portal

## Environment Setup

```bash
# Set your API base URL
export AP_API="https://agent-passport.onrender.com"

# Set your app credentials (from Portal)
export AP_APP_ID="your-app-id"
export AP_APP_KEY="your-secret-key"
```

## Test 1: Health Check

```bash
curl -s "$AP_API/healthz" | jq
```

**Expected Response:**
```json
{
  "status": "ok",
  "version": "0.1.0",
  "timestamp": "2026-02-01T12:00:00.000Z"
}
```

✅ **Pass if:** `status` is `"ok"`

## Test 2: JWKS Endpoint

```bash
curl -s "$AP_API/.well-known/jwks.json" | jq
```

**Expected Response:**
```json
{
  "keys": [
    {
      "kty": "OKP",
      "crv": "Ed25519",
      "x": "...",
      "kid": "passport-ed25519-001",
      "use": "sig",
      "alg": "EdDSA"
    }
  ]
}
```

✅ **Pass if:** Response contains `keys` array with at least one Ed25519 key

## Test 3: Agent Registration

First, generate an Ed25519 keypair. Use the provided script or your own:

```bash
# Using Node.js script (run from apps/passport-api)
node -e "
const { generateKeyPairSync } = require('crypto');
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
console.log('PUBLIC_KEY=' + publicKey.export({ type: 'spki', format: 'der' }).toString('base64'));
console.log('PRIVATE_KEY=' + privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'));
"
```

Then register the agent:

```bash
export PUBLIC_KEY="MCowBQYDK2VwAyEA..."  # Your generated public key

curl -s -X POST "$AP_API/agents/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"publicKey\": \"$PUBLIC_KEY\",
    \"name\": \"Smoke Test Agent\",
    \"metadata\": {\"test\": true}
  }" | jq
```

**Expected Response:**
```json
{
  "agentId": "550e8400-e29b-41d4-a716-446655440000",
  "publicKey": "MCowBQYDK2VwAyEA...",
  "name": "Smoke Test Agent",
  "status": "active",
  "metadata": {"test": true},
  "createdAt": "2026-02-01T12:00:00.000Z"
}
```

✅ **Pass if:** Response contains `agentId` and `status: "active"`

Save the agent ID:
```bash
export AGENT_ID="550e8400-e29b-41d4-a716-446655440000"  # From response
```

## Test 4: Request Challenge

```bash
curl -s -X POST "$AP_API/agents/$AGENT_ID/challenge" | jq
```

**Expected Response:**
```json
{
  "nonce": "abc123def456...",
  "expiresAt": "2026-02-01T12:05:00.000Z"
}
```

✅ **Pass if:** Response contains `nonce` (hex string) and `expiresAt` (future timestamp)

Save the nonce:
```bash
export NONCE="abc123def456..."  # From response
```

## Test 5: Sign Challenge and Get Token

Sign the nonce with your private key:

```bash
# Using Node.js
node -e "
const { createPrivateKey, sign } = require('crypto');
const privateKeyDer = Buffer.from(process.env.PRIVATE_KEY, 'base64');
const privateKey = createPrivateKey({ key: privateKeyDer, format: 'der', type: 'pkcs8' });
const nonceBytes = Buffer.from(process.env.NONCE, 'hex');
const signature = sign(null, nonceBytes, privateKey);
console.log('SIGNATURE=' + signature.toString('base64'));
"
```

Exchange signature for token:

```bash
export SIGNATURE="MEUCIQDk..."  # From signing script

curl -s -X POST "$AP_API/agents/$AGENT_ID/identity-token" \
  -H "Content-Type: application/json" \
  -d "{
    \"nonce\": \"$NONCE\",
    \"signature\": \"$SIGNATURE\"
  }" | jq
```

**Expected Response:**
```json
{
  "token": "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9...",
  "expiresAt": "2026-02-01T12:15:00.000Z"
}
```

✅ **Pass if:** Response contains JWT `token` and `expiresAt`

Save the token:
```bash
export TOKEN="eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9..."  # From response
```

## Test 6: Verify Token (App Endpoint)

```bash
curl -s -X POST "$AP_API/tokens/verify" \
  -H "Content-Type: application/json" \
  -H "X-App-Id: $AP_APP_ID" \
  -H "X-App-Key: $AP_APP_KEY" \
  -d "{\"token\": \"$TOKEN\"}" | jq
```

**Expected Response:**
```json
{
  "valid": true,
  "agentId": "550e8400-e29b-41d4-a716-446655440000",
  "publicKey": "MCowBQYDK2VwAyEA...",
  "name": "Smoke Test Agent",
  "status": "active",
  "iat": 1738411200,
  "exp": 1738412100,
  "risk": {
    "score": 25,
    "recommendedAction": "allow",
    "reasons": ["new_agent"]
  }
}
```

✅ **Pass if:** `valid: true` and `agentId` matches

## Test 7: Introspect Token

```bash
curl -s -X POST "$AP_API/tokens/introspect" \
  -H "Content-Type: application/json" \
  -H "X-App-Id: $AP_APP_ID" \
  -H "X-App-Key: $AP_APP_KEY" \
  -d "{\"token\": \"$TOKEN\"}" | jq
```

**Expected Response:**
```json
{
  "active": true,
  "sub": "550e8400-e29b-41d4-a716-446655440000",
  "iat": 1738411200,
  "exp": 1738412100,
  "iss": "agent-passport",
  "agent_name": "Smoke Test Agent",
  "agent_status": "active"
}
```

✅ **Pass if:** `active: true`

## Test 8: Revoke Token

```bash
curl -s -X POST "$AP_API/tokens/revoke" \
  -H "Content-Type: application/json" \
  -H "X-App-Id: $AP_APP_ID" \
  -H "X-App-Key: $AP_APP_KEY" \
  -d "{\"token\": \"$TOKEN\"}" | jq
```

**Expected Response:**
```json
{
  "revoked": true,
  "jti": "some-uuid",
  "expiresAt": "2026-02-01T12:15:00.000Z"
}
```

✅ **Pass if:** `revoked: true` and `jti` is present

## Test 9: Verify Revoked Token

After revoking, verify the same token again:

```bash
curl -s -X POST "$AP_API/tokens/verify" \
  -H "Content-Type: application/json" \
  -H "X-App-Id: $AP_APP_ID" \
  -H "X-App-Key: $AP_APP_KEY" \
  -d "{\"token\": \"$TOKEN\"}" | jq
```

**Expected Response:**
```json
{
  "valid": false,
  "reason": "token_revoked"
}
```

✅ **Pass if:** `valid: false` and `reason: "token_revoked"`

## Test 10: Verify Expired/Invalid Token

```bash
curl -s -X POST "$AP_API/tokens/verify" \
  -H "Content-Type: application/json" \
  -H "X-App-Id: $AP_APP_ID" \
  -H "X-App-Key: $AP_APP_KEY" \
  -d '{"token": "invalid.token.here"}' | jq
```

**Expected Response:**
```json
{
  "valid": false,
  "reason": "invalid_token"
}
```

✅ **Pass if:** `valid: false` and `reason` is present

## Test 11: Invalid App Credentials

```bash
curl -s -X POST "$AP_API/tokens/verify" \
  -H "Content-Type: application/json" \
  -H "X-App-Id: wrong-id" \
  -H "X-App-Key: wrong-key" \
  -d "{\"token\": \"$TOKEN\"}"
```

**Expected Response:** HTTP 401
```json
{
  "error": "unauthorized",
  "message": "Invalid app credentials"
}
```

✅ **Pass if:** HTTP status is 401

## Test 12: Rate Limiting

```bash
# Send 65 requests quickly to trigger rate limit
for i in {1..65}; do
  curl -s -X POST "$AP_API/agents/$AGENT_ID/challenge" \
    -H "Content-Type: application/json" &
done
wait

# Check for 429 response
curl -s -w "\nHTTP Code: %{http_code}\n" -X POST "$AP_API/agents/$AGENT_ID/challenge"
```

✅ **Pass if:** Eventually returns HTTP 429 with `Retry-After` header

## Full Automated Script

```bash
#!/bin/bash
set -e

AP_API="${AP_API:-https://agent-passport.onrender.com}"
AP_APP_ID="${AP_APP_ID:-your-app-id}"
AP_APP_KEY="${AP_APP_KEY:-your-app-key}"

echo "🔍 Testing Agent Passport API at $AP_API"
echo ""

# Test 1: Health
echo "1️⃣ Health check..."
HEALTH=$(curl -s "$AP_API/healthz")
if echo "$HEALTH" | jq -e '.status == "ok"' > /dev/null; then
  echo "   ✅ Health check passed"
else
  echo "   ❌ Health check failed"
  exit 1
fi

# Test 2: JWKS
echo "2️⃣ JWKS endpoint..."
JWKS=$(curl -s "$AP_API/.well-known/jwks.json")
if echo "$JWKS" | jq -e '.keys | length > 0' > /dev/null; then
  echo "   ✅ JWKS endpoint passed"
else
  echo "   ❌ JWKS endpoint failed"
  exit 1
fi

# Test 3: Generate keypair and register
echo "3️⃣ Agent registration..."
KEYPAIR=$(node -e "
const { generateKeyPairSync } = require('crypto');
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
console.log(JSON.stringify({
  publicKey: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
  privateKey: privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64')
}));
")
PUBLIC_KEY=$(echo "$KEYPAIR" | jq -r '.publicKey')
PRIVATE_KEY=$(echo "$KEYPAIR" | jq -r '.privateKey')

REGISTER=$(curl -s -X POST "$AP_API/agents/register" \
  -H "Content-Type: application/json" \
  -d "{\"publicKey\": \"$PUBLIC_KEY\", \"name\": \"Smoke Test $(date +%s)\"}")

AGENT_ID=$(echo "$REGISTER" | jq -r '.agentId')
if [ "$AGENT_ID" != "null" ]; then
  echo "   ✅ Agent registered: $AGENT_ID"
else
  echo "   ❌ Registration failed: $REGISTER"
  exit 1
fi

# Test 4: Challenge
echo "4️⃣ Request challenge..."
CHALLENGE=$(curl -s -X POST "$AP_API/agents/$AGENT_ID/challenge")
NONCE=$(echo "$CHALLENGE" | jq -r '.nonce')
if [ "$NONCE" != "null" ]; then
  echo "   ✅ Challenge received"
else
  echo "   ❌ Challenge failed: $CHALLENGE"
  exit 1
fi

# Test 5: Sign and get token
echo "5️⃣ Sign challenge and get token..."
SIGNATURE=$(PRIVATE_KEY="$PRIVATE_KEY" NONCE="$NONCE" node -e "
const { createPrivateKey, sign } = require('crypto');
const privateKey = createPrivateKey({
  key: Buffer.from(process.env.PRIVATE_KEY, 'base64'),
  format: 'der',
  type: 'pkcs8'
});
const signature = sign(null, Buffer.from(process.env.NONCE, 'hex'), privateKey);
console.log(signature.toString('base64'));
")

TOKEN_RESP=$(curl -s -X POST "$AP_API/agents/$AGENT_ID/identity-token" \
  -H "Content-Type: application/json" \
  -d "{\"nonce\": \"$NONCE\", \"signature\": \"$SIGNATURE\"}")

TOKEN=$(echo "$TOKEN_RESP" | jq -r '.token')
if [ "$TOKEN" != "null" ]; then
  echo "   ✅ Token received"
else
  echo "   ❌ Token exchange failed: $TOKEN_RESP"
  exit 1
fi

# Test 6: Verify token
echo "6️⃣ Verify token..."
VERIFY=$(curl -s -X POST "$AP_API/tokens/verify" \
  -H "Content-Type: application/json" \
  -H "X-App-Id: $AP_APP_ID" \
  -H "X-App-Key: $AP_APP_KEY" \
  -d "{\"token\": \"$TOKEN\"}")

if echo "$VERIFY" | jq -e '.valid == true' > /dev/null; then
  RISK_SCORE=$(echo "$VERIFY" | jq '.risk.score')
  echo "   ✅ Token verified (risk score: $RISK_SCORE)"
else
  echo "   ❌ Verification failed: $VERIFY"
  exit 1
fi

# Test 7: Introspect
echo "7️⃣ Introspect token..."
INTROSPECT=$(curl -s -X POST "$AP_API/tokens/introspect" \
  -H "Content-Type: application/json" \
  -H "X-App-Id: $AP_APP_ID" \
  -H "X-App-Key: $AP_APP_KEY" \
  -d "{\"token\": \"$TOKEN\"}")

if echo "$INTROSPECT" | jq -e '.active == true' > /dev/null; then
  echo "   ✅ Introspection passed"
else
  echo "   ❌ Introspection failed: $INTROSPECT"
  exit 1
fi

# Test 8: Revoke token
echo "8️⃣ Revoke token..."
REVOKE=$(curl -s -X POST "$AP_API/tokens/revoke" \
  -H "Content-Type: application/json" \
  -H "X-App-Id: $AP_APP_ID" \
  -H "X-App-Key: $AP_APP_KEY" \
  -d "{\"token\": \"$TOKEN\"}")

if echo "$REVOKE" | jq -e '.revoked == true' > /dev/null; then
  REVOKED_JTI=$(echo "$REVOKE" | jq -r '.jti')
  echo "   ✅ Token revoked (jti: $REVOKED_JTI)"
else
  echo "   ❌ Revocation failed: $REVOKE"
  exit 1
fi

# Test 9: Verify revoked token
echo "9️⃣ Verify revoked token..."
VERIFY_REVOKED=$(curl -s -X POST "$AP_API/tokens/verify" \
  -H "Content-Type: application/json" \
  -H "X-App-Id: $AP_APP_ID" \
  -H "X-App-Key: $AP_APP_KEY" \
  -d "{\"token\": \"$TOKEN\"}")

if echo "$VERIFY_REVOKED" | jq -e '.valid == false and .reason == "token_revoked"' > /dev/null; then
  echo "   ✅ Revoked token correctly rejected"
else
  echo "   ❌ Revoked token not rejected: $VERIFY_REVOKED"
  exit 1
fi

echo ""
echo "🎉 All smoke tests passed!"
```

Save as `smoke-test.sh` and run:
```bash
chmod +x smoke-test.sh
AP_APP_ID="your-id" AP_APP_KEY="your-key" ./smoke-test.sh
```

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| `ECONNREFUSED` | API not running | Check deployment status on Render |
| `401 Unauthorized` | Invalid app credentials | Verify X-App-Id and X-App-Key |
| `404 Not Found` | Agent doesn't exist | Re-register the agent |
| `400 Bad Request` | Invalid signature | Check keypair generation and signing |
| `422 Unprocessable` | Token cannot be revoked | Ensure you're passing a valid JWT string |
| `429 Too Many Requests` | Rate limited | Wait for Retry-After seconds |

## Next Steps

- Read the [Integration Guide](./INTEGRATION.md) for code examples
- Review [Security Documentation](./SECURITY.md) for threat model
- Check [OpenAPI Spec](./openapi.yaml) for full API reference
