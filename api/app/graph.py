"""Deterministic directed-acyclic dependency operations; no model calls."""
from collections import deque

def adjacency(nodes, edges, reverse=False):
    graph = {str(node): set() for node in nodes}
    for before, after in edges:
        before, after = str(before), str(after)
        if before not in graph or after not in graph:
            raise ValueError('Every dependency must reference a task in this project')
        if before == after:
            raise ValueError('A task cannot depend on itself')
        graph[after if reverse else before].add(before if reverse else after)
    return graph

def validate_dag(nodes, edges):
    graph = adjacency(nodes, edges)
    incoming = {node: 0 for node in graph}
    for targets in graph.values():
        for target in targets: incoming[target] += 1
    queue = deque(node for node, count in incoming.items() if count == 0)
    visited = 0
    while queue:
        node = queue.popleft(); visited += 1
        for target in graph[node]:
            incoming[target] -= 1
            if incoming[target] == 0: queue.append(target)
    if visited != len(graph):
        raise ValueError('This dependency would create a cycle')

def reachable(nodes, edges, start, reverse=False):
    graph = adjacency(nodes, edges, reverse)
    start = str(start)
    if start not in graph: raise ValueError('Task is not in this project')
    seen = set(); queue = deque(graph[start])
    while queue:
        node = queue.popleft()
        if node in seen: continue
        seen.add(node); queue.extend(graph[node] - seen)
    seen.discard(start)
    return sorted(seen)
