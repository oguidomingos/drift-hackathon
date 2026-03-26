"""
DEAP-based genetic algorithm for strategy parameter optimization.
"""

import random
import numpy as np
from deap import base, creator, tools, algorithms
from functools import partial

from .genome import N_PARAMS, PARAM_NAMES, genome_to_params
from .fitness import evaluate_fitness


def setup_ga(
    funding_data: dict,
    population_size: int = 50,
    use_walk_forward: bool = True,
) -> tuple[base.Toolbox, tools.Statistics, tools.HallOfFame]:
    """Setup DEAP genetic algorithm."""

    # Create fitness class (maximize Calmar ratio)
    if not hasattr(creator, 'FitnessMax'):
        creator.create("FitnessMax", base.Fitness, weights=(1.0,))
    if not hasattr(creator, 'Individual'):
        creator.create("Individual", list, fitness=creator.FitnessMax)

    toolbox = base.Toolbox()

    # Gene: random float in [0, 1]
    toolbox.register("attr_gene", random.random)
    toolbox.register(
        "individual",
        tools.initRepeat,
        creator.Individual,
        toolbox.attr_gene,
        n=N_PARAMS,
    )
    toolbox.register("population", tools.initRepeat, list, toolbox.individual)

    # Fitness function
    toolbox.register(
        "evaluate",
        partial(evaluate_fitness, funding_data=funding_data, use_walk_forward=use_walk_forward),
    )

    # Operators
    toolbox.register("mate", tools.cxBlend, alpha=0.5)
    toolbox.register("mutate", tools.mutGaussian, mu=0, sigma=0.1, indpb=0.2)
    toolbox.register("select", tools.selTournament, tournsize=3)

    # Clamp genes to [0, 1] after crossover/mutation
    def clamp_individual(individual):
        for i in range(len(individual)):
            individual[i] = max(0.0, min(1.0, individual[i]))
        return individual

    toolbox.decorate("mate", tools.DeltaPenalty(lambda ind: all(0 <= g <= 1 for g in ind), -100))

    # Stats
    stats = tools.Statistics(lambda ind: ind.fitness.values[0])
    stats.register("avg", np.mean)
    stats.register("min", np.min)
    stats.register("max", np.max)
    stats.register("std", np.std)

    # Hall of fame
    hof = tools.HallOfFame(5)

    return toolbox, stats, hof


def run_optimization(
    funding_data: dict,
    population_size: int = 50,
    n_generations: int = 30,
    crossover_prob: float = 0.7,
    mutation_prob: float = 0.3,
    use_walk_forward: bool = True,
    verbose: bool = True,
) -> dict:
    """
    Run the genetic algorithm optimization.
    Returns best parameters and optimization history.
    """
    toolbox, stats, hof = setup_ga(funding_data, population_size, use_walk_forward)

    pop = toolbox.population(n=population_size)

    if verbose:
        print(f"\nGenetic Algorithm Optimization")
        print(f"Population: {population_size}")
        print(f"Generations: {n_generations}")
        print(f"Parameters: {N_PARAMS}")
        print(f"{'='*60}")

    # Run evolution
    pop, logbook = algorithms.eaSimple(
        pop,
        toolbox,
        cxpb=crossover_prob,
        mutpb=mutation_prob,
        ngen=n_generations,
        stats=stats,
        halloffame=hof,
        verbose=verbose,
    )

    # Best individual
    best_genome = list(hof[0])
    best_params = genome_to_params(best_genome)
    best_fitness = hof[0].fitness.values[0]

    if verbose:
        print(f"\n{'='*60}")
        print(f"BEST INDIVIDUAL (Calmar = {best_fitness:.4f})")
        print(f"{'='*60}")
        for name, val in best_params.items():
            print(f"  {name}: {val:.6f}" if isinstance(val, float) else f"  {name}: {val}")

    return {
        'best_params': best_params,
        'best_fitness': best_fitness,
        'best_genome': best_genome,
        'logbook': logbook,
        'hall_of_fame': [
            {'params': genome_to_params(list(ind)), 'fitness': ind.fitness.values[0]}
            for ind in hof
        ],
    }
