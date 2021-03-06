export default interface IE2ETest {
    url: string;
    timeout?: number;
    waitFor?: number | string | null;
    group?: string;
    name?: string;
    width?: number;
    height?: number;
    shift?: number;
    threshold: string;
}