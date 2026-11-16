import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PasswordInput } from "./PasswordInput";

afterEach(cleanup);

const field = () => screen.getByLabelText("Password") as HTMLInputElement;

describe("PasswordInput", () => {
  it("starts masked with a 'Show password' button", () => {
    render(
      <label>
        Password
        <PasswordInput defaultValue="secret123" />
      </label>,
    );
    expect(field().type).toBe("password");
    expect(screen.getByRole("button", { name: "Show password" })).toBeInTheDocument();
  });

  it("reveals the password on click and masks it again on the next click", () => {
    render(
      <label>
        Password
        <PasswordInput defaultValue="secret123" />
      </label>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(field().type).toBe("text");
    expect(field().value).toBe("secret123");
    const hide = screen.getByRole("button", { name: "Hide password" });
    expect(hide).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(hide);
    expect(field().type).toBe("password");
    expect(field().value).toBe("secret123"); // typed text is kept
    expect(screen.getByRole("button", { name: "Show password" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("does not submit the surrounding form when the eye is clicked", () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <label>
          Password
          <PasswordInput />
        </label>
      </form>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("passes normal input props through and works as a controlled field", () => {
    const onChange = vi.fn();
    render(
      <label>
        Password
        <PasswordInput value="abc" onChange={onChange} required autoComplete="current-password" />
      </label>,
    );
    expect(field()).toBeRequired();
    expect(field()).toHaveAttribute("autocomplete", "current-password");
    fireEvent.change(field(), { target: { value: "abcd" } });
    expect(onChange).toHaveBeenCalled();
  });
});
