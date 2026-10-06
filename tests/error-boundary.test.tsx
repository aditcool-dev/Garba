// @vitest-environment jsdom
import { afterEach,it,expect,vi } from "vitest";
import React from "react";
import { cleanup,render,screen,waitFor } from "@testing-library/react";
import ErrorPage from "../app/error";
afterEach(()=>{cleanup();vi.restoreAllMocks();history.replaceState(null,"","/");});
it("logs route/message/stack/digest but shows only a reference by default",async()=>{
  const log=vi.spyOn(console,"error").mockImplementation(()=>{});
  history.replaceState(null,"","/discover");
  const error=Object.assign(new Error("Internal fixture detail"),{digest:"12345"});
  render(<ErrorPage error={error} reset={()=>{}} />);
  await waitFor(()=>expect(log).toHaveBeenCalled());
  expect(log.mock.calls[0][1]).toMatchObject({message:error.message,stack:error.stack,digest:"12345",route:"/discover"});
  expect(screen.getByText("GM-12345")).toBeTruthy();expect(screen.queryByText(error.message)).toBeNull();
});
it("shows the actual message only with debug=1",async()=>{
  vi.spyOn(console,"error").mockImplementation(()=>{});history.replaceState(null,"","/discover?debug=1");
  render(<ErrorPage error={new Error("Debug fixture detail")} reset={()=>{}} />);
  await waitFor(()=>expect(screen.getByText("Debug fixture detail")).toBeTruthy());
});
