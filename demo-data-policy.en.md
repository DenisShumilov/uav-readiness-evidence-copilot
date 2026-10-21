# Demo Data Policy

*[Українською](demo-data-policy.md) · English*

Demo data means example files used to show the project.

All demo data in this repository must be synthetic.

Synthetic means fake, educational, and not copied from real operations.

## Allowed Demo Data

Allowed examples:

- fake BOM files, meaning fake lists of parts;
- fake manual snippets, meaning fake instruction text;
- fake QA notes, meaning fake quality notes;
- fake test logs, meaning fake test tables;
- fake config dumps, meaning fake settings text;
- fake evidence locks, meaning fake blocked claims.

The examples may show:

- document completeness;
- missing evidence;
- conflicting paperwork;
- expired inspection notes;
- training record presence;
- maintenance record presence.

## Blocked Demo Data

Do not include:

- real coordinates;
- real routes;
- mission names;
- targeting data;
- payload data;
- tactical notes;
- live telemetry;
- operational frequencies;
- real serial numbers;
- real names or personal data;
- real photos with metadata.

Telemetry means data from a live system, such as position, speed, sensor values, or status.

## Labeling Rule

Every demo folder must clearly say:

`Synthetic demo data only. Not operationally valid.`

Operationally valid means usable for real-world operation. Demo data must not be usable that way.

## Mixing Rule

Do not mix synthetic evidence and real evidence.

If a future version supports user uploads, the UI must clearly label:

- synthetic;
- user-provided;
- generated output.

UI means user interface, the screen a person clicks and reads.
