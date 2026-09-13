# Galla Design System Specification (`design.md`)

> **Theme**: Clean Luxury Editorial White & Dusty Rose Velvet  
> **Mathematical System**: Golden Ratio ($\phi \approx 1.618$) & Fibonacci Spatial Sequence  
> **Decoupled Alerts**: Functional Pure Red & Pure Green for unmistakable real-world retail clarity  

---

## 1. Color Palette & Token Architecture

The color system is organized into **Brand & Ledger Theme Tokens** (defined in [`galla-colors.css`](file:///e:/E%20drive%20backup/Fourier-Tech/Galla/galla-colors.css) and [`globals.css`](file:///e:/E%20drive%20backup/Fourier-Tech/Galla/src/app/globals.css)) and **Functional Decoupled Alert Tokens**.

### A. Core Theme Tokens

| Token Variable | Hex Code | Visual Tone | Primary Role & Where It Is Used |
| :--- | :--- | :--- | :--- |
| `--galla-paper` | `#FAF8F9` | Silky Soft Porcelain | Main application canvas background (`<body>`), table column headers background, inactive pill backgrounds. |
| `--galla-surface` | `#FFFFFF` | Pure Crisp White | Card backgrounds, elevated panels, modal dialog windows, search input boxes. |
| `--galla-sidebar` | `#FFFFFF` | Editorial White | Left sidebar navigation background, blending smoothly with the salon logo. |
| `--galla-sidebar-border`| `#F0E4E8` | Delicate Hairline Rose | Right border separating sidebar from main canvas, role switcher top divider. |
| `--galla-ink` | `#1E1217` | Velvet Espresso Carbon | Primary headings, customer names, product names, KPI hero stat values, form input text. |
| `--galla-ink-soft` | `#7A666E` | Muted Warm Slate | Secondary descriptions, timestamps, item subtitles, table column headers, phone numbers, order IDs. |
| `--galla-teal` | `#B83A5D` | Dusty Rose Velvet | Primary brand CTA buttons (`+ New Order`), active sidebar navigation background and border, active filter pill, primary text action links (`Settle Balance →`, `Collect →`). |
| `--galla-teal-soft` | `#FDF2F5` | Delicate Blush Silk | Active navigation item background, "Paid in Full" status pill background, active segmented control. |
| `--galla-brass` | `#B86A28` | Warm Polished Amber | Cash in Drawer metric, due balance warnings (`₹1,000 due`), Product sales bars in revenue chart. |
| `--galla-brass-soft` | `#FEF7EC` | Warm Peach Silk | "Advance Paid" status badge background. |
| `--galla-brick` | `#C23B4E` | Crimson Coral | Outflows in expense table (`−₹4,200`), petty cash CTA icon, expense summary tone. |
| `--galla-brick-soft` | `#FFF1F2` | Delicate Rose Blush | Expense row badges and alert highlights. |
| `--galla-sage` | `#107B53` | Botanical Emerald | Income today metric value, revenue trends. |
| `--galla-sage-soft` | `#EAF7F1` | Fresh Mint Silk | Soft green tint for financial highlights. |
| `--galla-line` | `#EFE5E9` | Tailored Hairline Divider | Card borders, table row dividers, modal section lines, input borders. |

---

### B. Functional Alert System (Decoupled from Theme)

To ensure zero ambiguity during fast-paced salon operations, all warnings and successes use pure standard colors:

| Alert Type | Background | Text Color | Border Color | Icon / Indicator | Where It Is Used |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Critical Warning & Danger** | `bg-red-50` (`#FEF2F2`) | `text-red-900` (`#7F1D1D`) / `text-red-800` (`#991B1B`) | `border-red-300` (`#FCA5A5`) | `AlertTriangle` (`#DC2626`) | Low-stock warning banner (Overview & Inventory tabs), low stock tag (`bg-red-100 text-red-700`), "Refunded" status pill, Real-time warning notification toast. |
| **Success & Settlement** | `bg-green-50` (`#F0FDF4`) | `text-green-800` (`#166534`) | `border-green-300` (`#86EFAC`) | `CheckCircle2` (`#16A34A`) | "Completed" status badge (`#15803D`), "Mark Done →" lifecycle transition button, positive weekly margin (`+₹28,800`), Real-time success notification toast. |

---

## 2. Typography Architecture

### Font Families

1. **Heading / Display Font**: **`Outfit`** (`var(--font-outfit)`, sans-serif)
   * *Characteristics*: Geometric, circular, modern high-fashion beauty atelier feel.
   * *Used for*: All `h1–h6`, brand parlour subtitle, Section Titles, KPI hero numbers, financial amount figures (`font-heading`).
2. **Body / Interface Font**: **`Inter`** (`var(--font-inter)`, sans-serif)
   * *Characteristics*: High x-height, neutral, exceptional legibility for dense tabular data and controls.
   * *Used for*: Body text, table cells, descriptions, buttons, input fields, navigation links (`font-sans`).
3. **Tabular / Monospace Font**: **`Geist Mono`** (`var(--font-geist-mono)`, monospace)
   * *Characteristics*: Fixed-width characters with clean vertical stroke alignment.
   * *Used for*: Order IDs (`#1042`), Expense IDs (`EXP-01`), phone numbers, numerical timestamps (`font-mono`).

---

## 3. Typographic Scale & Usage Matrix

Governed by the **Golden Ratio modular scale ($\phi \approx 1.618$, $\sqrt{\phi} \approx 1.272$)**:

| Font Size | Font Family | Weight | Line Height | Tracking | Where It Is Used |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`34px`** | Outfit | Semibold (`600`) | `34px` (`1.0`) | `-0.02em` | **Primary KPI Stat Values** (`₹7,200`, `₹6,700`, `₹2,000`, `₹2,800`). |
| **`21px`** | Outfit | Semibold (`600`) | `34px` ($\phi$) | `-0.015em` | **Section Titles** ("Today's Galla & Counter", "Order & Service Transactions", etc.), Modal dialogue titles. |
| **`16px`** | Outfit | Semibold (`600`) | `26px` ($\phi$) | `-0.01em` | **Financial Table Amounts** (`₹1,200`), Chart titles, Inflow/Outflow breakdown card titles. |
| **`15px`** | Inter | Semibold (`600`) | `22px` (`1.47`) | `normal` | **Table Primary Rows**: Customer names (`Priya Shah`), Product names (`L'Oréal Shampoo 200ml`), Expense descriptions. |
| **`14px`** | Inter / Mono | Medium (`500`) | `21px` ($\phi$) | `normal` | Primary button text, search input text, customer phone numbers in table, inventory stock count (`12 pcs`). |
| **`13px`** | Inter | Regular / Medium | `21px` ($\phi$) | `normal` | **Table Secondary Metadata**: Service breakdown & times (`Keratin Hair Wash • 10:30 AM`), payment mode (`Cash`), action links (`Settle Balance →`, `Mark Done →`), sidebar nav labels, filter buttons. |
| **`13px`** | Geist Mono | Medium (`500`) | `21px` ($\phi$) | `normal` | **Ledger IDs**: Order IDs (`#1042`), Expense IDs (`EXP-01`). |
| **`12px`** | Outfit / Inter | Semibold (`600`) | `16px` (`1.33`) | `0.05em` | **Table Column Headers** (Uppercase tracking-wider: `ORDER ID`, `CUSTOMER`, `AMOUNT`, etc.), Status pills (`Completed`, `Advance paid`). |
| **`11px`** | Outfit / Inter | Medium (`500`) | `16px` (`1.45`) | `0.03em` | Parlour brand subtitle (`KRISHKUMARI BEAUTY PARLOUR`), role switcher helper text, micro tags (`low stock`). |

---

## 4. Spatial Scale & Layout Proportions (Fibonacci Rhythm)

Spacing and layout bounds follow the Fibonacci progression:
$$5\text{px} \rightarrow 8\text{px} \rightarrow 13\text{px} \rightarrow 21\text{px} \rightarrow 34\text{px} \rightarrow 55\text{px} \rightarrow 89\text{px} \rightarrow 144\text{px} \rightarrow 233\text{px} \rightarrow 377\text{px}$$

### Component Dimensions & Padding

* **Sidebar**:
  * Width: **`233px`** ($F_{13}$)
  * Top Logo Area Margin: **`mb-[34px]`** ($F_9$)
  * Horizontal Padding: **`px-[13px]`** ($F_7$)
  * Nav Item Padding: **`px-[13px] py-[8px]`** ($13 / 8 = 1.625 \approx \phi$)
  * Bottom Clearance: **`pb-[55px]`** ($F_{10}$) &mdash; ensures complete separation from dev overlay widgets.
* **Cards & Panels**:
  * Card Padding: **`p-[21px]`** ($F_8$)
  * Border Radius: **`rounded-[5px]`** ($F_5$)
  * Outer Grid Gap: **`gap-px`** with hairline separator lines.
* **Tables**:
  * Row Padding: **`px-[21px] py-[16px]`** &mdash; generous breathing room matching the larger 15px/16px row typography.
  * Header Padding: **`px-[21px] py-[14px]`**
  * Column Separation: Harmonious grid fractions with minimum fixed column widths (`w-16`, `w-[110px]`).
* **Buttons & Filter Controls**:
  * Padding: **`px-[13px] py-[8px]`** ($F_7 \times F_6$)
  * Border Radius: **`rounded-[5px]`** ($F_5$)
* **Modals & Dialogs**:
  * Cash / Expense Modal Width: **`max-w-[377px]`** ($F_{14}$)
  * Order / Service Modal Width: **`max-w-[420px]`**
  * Inner Padding: **`p-[21px]`** ($F_8$)
* **Analytics Tab Grid**:
  * Horizontal Split: **`grid-cols-1 md:grid-cols-[1.618fr_1fr] gap-[21px]`** &mdash; true Golden Section division.
  * Bar Chart Height: **`height: 233px`** ($F_{13}$).

---

## 5. Summary Quick-Reference Cheat Sheet

```
Primary CTA Button:
  - Font: Inter Medium, 14px (leading 21px)
  - Color: #FFFFFF text on #B83A5D (Dusty Rose Velvet)
  - Padding: px-[13px] py-[8px], rounded-[5px]

Table Row:
  - Customer/Item: Outfit/Inter Semibold 15px (#1E1217)
  - Subtitle/Time: Inter Regular 13px (#7A666E)
  - Amount: Outfit Semibold 16px (#1E1217 tabular-nums)
  - ID: Geist Mono Medium 13px (#7A666E)
  - Row Padding: px-[21px] py-[16px]

Status Badges:
  - Completed: #15803D on #F0FDF4 with border #86EFAC (12px semibold)
  - Advance Paid: #B86A28 on #FEF7EC with border #B86A28 (12px semibold)
  - Paid in Full: #B83A5D on #FDF2F5 with border #B83A5D (12px semibold)
  - Refunded: #DC2626 on #FEF2F2 with border #FCA5A5 (12px semibold)

Warning Banner:
  - Background: bg-red-50 (#FEF2F2)
  - Border: border-red-300 (#FCA5A5)
  - Text: text-red-900 / text-red-800
  - Icon: AlertTriangle 16px (#DC2626)
  - Padding: px-[21px] py-[13px], rounded-[5px]
```
