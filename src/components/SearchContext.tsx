"use client";

import { createContext, useContext, useState } from "react";

interface SearchContextValue {
  query: string;
  setQuery: React.Dispatch<React.SetStateAction<string>>;
}

/** Global header-search state. The header search input writes here; pages
 *  consume it to filter their rendered data. Lives above the routes so the
 *  query survives navigation within the app. */
const SearchContext = createContext<SearchContextValue>({
  query: "",
  setQuery: () => {},
});

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [query, setQuery] = useState("");
  return (
    <SearchContext.Provider value={{ query, setQuery }}>
      {children}
    </SearchContext.Provider>
  );
}

export function useSearch() {
  return useContext(SearchContext);
}