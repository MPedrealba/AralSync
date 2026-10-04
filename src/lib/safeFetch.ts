/**
 * Safe fetch and response parsing utilities to prevent JSON parsing crashes
 * like "SyntaxError: Unexpected token '<', '<!DOCTYPE '... is not valid JSON".
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface SafeApiResponse<T = any> {
  success: boolean;
  status: number;
  data?: T;
  error?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

/**
 * Safely parses a Fetch Response object.
 * Verifies that the response is valid JSON and that res.ok is true before parsing.
 * Returns a standardized SafeApiResponse object without throwing SyntaxError.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function parseJsonResponse<T = any>(res: Response): Promise<SafeApiResponse<T>> {
  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.toLowerCase().includes("application/json");

  if (!isJson) {
    let friendlyError = `Server returned non-JSON format (HTTP ${res.status}).`;
    if (res.status === 404) {
      friendlyError = "The requested endpoint or resource was not found (HTTP 404).";
    } else if (res.status === 401) {
      friendlyError = "Your session has expired. Please log in again.";
    } else if (res.status === 403) {
      friendlyError = "You do not have permission to perform this action (HTTP 403).";
    } else if (res.status >= 500) {
      friendlyError = `Server error encountered (HTTP ${res.status}). Please try again later.`;
    }

    return {
      success: false,
      status: res.status,
      error: friendlyError,
    };
  }

  try {
    const json = await res.json();

    if (!res.ok) {
      const errorMsg =
        json?.error ||
        json?.message ||
        `Request failed with status ${res.status}.`;
      return {
        ...json,
        success: false,
        status: res.status,
        error: errorMsg,
      };
    }

    return {
      success: json?.success ?? true,
      status: res.status,
      data: json?.data !== undefined ? json.data : json,
      ...json,
    };
  } catch {
    return {
      success: false,
      status: res.status,
      error: "Failed to parse server response.",
    };
  }
}

/**
 * Wrapper around standard fetch that automatically catches network failures
 * and safely parses the response without throwing JSON syntax errors.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function safeFetch<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<SafeApiResponse<T>> {
  try {
    const res = await fetch(input, init);
    return await parseJsonResponse<T>(res);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Network error. Please check your internet connection.";
    return {
      success: false,
      status: 0,
      error: msg,
    };
  }
}
