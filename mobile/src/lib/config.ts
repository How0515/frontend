export const config = {
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || "http://10.0.2.2:8080/api/v1",
  chainRpcUrl: process.env.EXPO_PUBLIC_CHAIN_RPC_URL || "http://10.0.2.2:8545",
  chainId: Number(process.env.EXPO_PUBLIC_CHAIN_ID || 31337),
  trustTicketContractAddress:
    process.env.EXPO_PUBLIC_TRUST_TICKET_CONTRACT_ADDRESS || "",
};
