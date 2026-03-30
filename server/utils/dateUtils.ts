export const round1dec = (num: number): number => {
    return Math.round(num * 10) / 10;
};

export const dateDiffDays = (from: Date, to: Date): number => {
    const diffTime = Math.abs(to.getTime() - from.getTime());
    return diffTime / (1000 * 60 * 60 * 24);
};
