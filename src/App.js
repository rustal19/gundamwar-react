import React, { useState } from "react";
import SearchForm from "./components/SearchForm"; // ここで SearchForm を読み込む

const App = () => {
  const [searchParams, setSearchParams] = useState(null);

  // SearchForm から受け取った検索条件を保存
  const handleSearch = (params) => {
    console.log("検索条件:", params);
    setSearchParams(params);
  };

  return (
    <div style={{ padding: "1rem" }}>
      <h1>カード検索</h1>

      <SearchForm onSearch={handleSearch} />

      {searchParams && (
        <div style={{ marginTop: "1rem" }}>
          <h2>検索条件:</h2>
          <pre>{JSON.stringify(searchParams, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

export default App;